import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMatchCommentary, fetchMatches } from "../services/api";
import { Commentary, Match, WSMessage } from "../types";
import { useWebSocket } from "./useWebSocket";

interface UseMatchData {
  matches: Match[];
  isLoading: boolean;
  error: string | null;
  commentary: Commentary[];
  isCommentaryLoading: boolean;
  wsError: string | null;
  status: ReturnType<typeof useWebSocket>["status"];
  activeMatchId: string | number | null;
  subscribedMatchIds: Set<string>;
  toggleSubscription: (id: string | number) => void;
  subscribeMatch: (id: string | number) => void;
  unsubscribeMatch: (id: string | number) => void;
  newMatchesCount: number;
  dismissNewMatches: () => void;
  watchMatch: (id: string | number) => void;
  unwatchMatch: (id: string | number) => void;
  reloadMatches: () => void;
}

export const useMatchData = (): UseMatchData => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentary, setCommentary] = useState<Commentary[]>([]);
  const [isCommentaryLoading, setIsCommentaryLoading] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | number | null>(null);
  const [newMatchesCount, setNewMatchesCount] = useState(0);
  const [subscribedMatchIds, setSubscribedMatchIds] = useState<Set<string>>(new Set());
  const latestMatchIdRef = useRef<string | number | null>(null);
  const subscribedMatchIdsRef = useRef(new Set<string>());
  const hasLoadedRef = useRef(false);
  const knownMatchIdsRef = useRef(new Set<string>());
  const newMatchesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWSMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case "matchCreated":
        if (msg.data) {
          setMatches((prev) => {
            const exists = prev.some((m) => String(m.id) === String(msg.data.id));
            if (exists) return prev;
            return [msg.data, ...prev];
          });
          setNewMatchesCount((prev) => prev + 1);
        }
        break;
      case "score_update":
        // Strict Pub/Sub: Only process score updates for subscribed matches
        if (!subscribedMatchIdsRef.current.has(String(msg.matchId))) {
          return;
        }
        setMatches((prevMatches) =>
          prevMatches.map((m) => {
            // eslint-disable-next-line eqeqeq
            if (m.id == msg.matchId) {
              return {
                ...m,
                homeScore: msg.data.homeScore,
                awayScore: msg.data.awayScore,
              };
            }
            return m;
          })
        );
        break;
      case "commentary": {
        // Strict Pub/Sub: Only process commentary for subscribed matches
        if (!subscribedMatchIdsRef.current.has(String(msg.data.matchId))) {
          return;
        }
        if (
          latestMatchIdRef.current == null ||
          // eslint-disable-next-line eqeqeq
          msg.data.matchId != latestMatchIdRef.current
        ) {
          return;
        }
        const normalized = {
          ...msg.data,
          createdAt: msg.data.createdAt ?? new Date().toISOString(),
        };
        setCommentary((prev) => [normalized, ...prev]);
        break;
      }
      case "error":
        setWsError(`${msg.code}: ${msg.message}`);
        break;
      case "subscribed":
      case "unsubscribed":
      case "subscribed_all":
      case "unsubscribed_all":
      case "subscriptions":
      case "welcome":
      case "pong":
        break;
      default:
        break;
    }
  }, []);

  const {
    status,
    connectGlobal,
    subscribeMatch: wsSubscribeMatch,
    unsubscribeMatch: wsUnsubscribeMatch,
  } = useWebSocket(handleWSMessage);

  const subscribeMatch = useCallback(
    (id: string | number) => {
      const matchId = String(id);
      subscribedMatchIdsRef.current.add(matchId);
      setSubscribedMatchIds((prev) => new Set(prev).add(matchId));
      wsSubscribeMatch(id);
    },
    [wsSubscribeMatch]
  );

  const unsubscribeMatch = useCallback(
    (id: string | number) => {
      const matchId = String(id);
      subscribedMatchIdsRef.current.delete(matchId);
      setSubscribedMatchIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
      wsUnsubscribeMatch(id);
    },
    [wsUnsubscribeMatch]
  );

  const toggleSubscription = useCallback(
    (id: string | number) => {
      const matchId = String(id);
      if (subscribedMatchIdsRef.current.has(matchId)) {
        unsubscribeMatch(id);
      } else {
        subscribeMatch(id);
      }
    },
    [subscribeMatch, unsubscribeMatch]
  );

const FINISHED_RETENTION_MS = 5 * 60 * 1000; // 5 minutes grace period after ending

const isMatchExpired = (match: Match, now = new Date()): boolean => {
  const statusLower = (match.status || '').toLowerCase();
  if (statusLower === 'finished' && match.endTime) {
    const endMs = new Date(match.endTime).getTime();
    if (!isNaN(endMs) && now.getTime() > endMs + FINISHED_RETENTION_MS) {
      return true;
    }
  }
  return false;
};

  const loadMatches = useCallback(async () => {
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const data = await fetchMatches(100);
      const rawMatches = data.data || [];
      const now = new Date();
      // Filter out matches that ended more than 5 minutes ago
      const nextMatches = rawMatches.filter((m) => !isMatchExpired(m, now));
      const nextMatchIds = new Set(nextMatches.map((match) => String(match.id)));
      setMatches((prevMatches) => {
        const prevById = new Map<string, Match>(
          prevMatches.map((match) => [String(match.id), match])
        );
        return nextMatches.map((match) => {
          const matchId = String(match.id);
          const prev = prevById.get(matchId);
          const isSubscribed = subscribedMatchIdsRef.current.has(matchId);
          if (prev && isSubscribed) {
            return {
              ...match,
              homeScore: Math.max(match.homeScore, prev.homeScore),
              awayScore: Math.max(match.awayScore, prev.awayScore),
            };
          }
          return match;
        });
      });

      // Cleanup active match if it expired past 5-minute retention window
      if (latestMatchIdRef.current) {
        const activeStillExists = nextMatches.some(
          // eslint-disable-next-line eqeqeq
          (m) => m.id == latestMatchIdRef.current
        );
        if (!activeStillExists) {
          setActiveMatchId(null);
          latestMatchIdRef.current = null;
          setCommentary([]);
          setIsCommentaryLoading(false);
        }
      }
      if (knownMatchIdsRef.current.size > 0) {
        let newCount = 0;
        nextMatchIds.forEach((matchId) => {
          if (!knownMatchIdsRef.current.has(matchId)) {
            newCount += 1;
          }
        });
        if (newCount > 0) {
          setNewMatchesCount((prev) => prev + newCount);
          if (newMatchesTimeoutRef.current) {
            clearTimeout(newMatchesTimeoutRef.current);
          }
          newMatchesTimeoutRef.current = setTimeout(() => {
            setNewMatchesCount(0);
            newMatchesTimeoutRef.current = null;
          }, 5000);
        }
      }
      knownMatchIdsRef.current = nextMatchIds;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load matches";
      setError(msg);
    } finally {
      if (!hasLoadedRef.current) {
        setIsLoading(false);
        hasLoadedRef.current = true;
      }
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadMatches();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadMatches]);

  useEffect(() => {
    connectGlobal();
  }, [connectGlobal]);

  useEffect(() => {
    latestMatchIdRef.current = activeMatchId;
  }, [activeMatchId]);

  useEffect(() => {
    return () => {
      if (newMatchesTimeoutRef.current) {
        clearTimeout(newMatchesTimeoutRef.current);
      }
    };
  }, []);

  const dismissNewMatches = useCallback(() => {
    if (newMatchesTimeoutRef.current) {
      clearTimeout(newMatchesTimeoutRef.current);
      newMatchesTimeoutRef.current = null;
    }
    setNewMatchesCount(0);
  }, []);

  const watchMatch = useCallback(
    (id: string | number) => {
      setCommentary([]);
      setIsCommentaryLoading(true);
      setWsError(null);
      latestMatchIdRef.current = id;
      setActiveMatchId(id);
      subscribeMatch(id);

      fetchMatchCommentary(id)
        .then((data) => {
          // eslint-disable-next-line eqeqeq
          if (latestMatchIdRef.current == id) {
            setCommentary(data.data || []);
          }
        })
        .catch(() => {
          // eslint-disable-next-line eqeqeq
          if (latestMatchIdRef.current == id) {
            setCommentary([]);
          }
        })
        .finally(() => {
          // eslint-disable-next-line eqeqeq
          if (latestMatchIdRef.current == id) {
            setIsCommentaryLoading(false);
          }
        });
    },
    [subscribeMatch]
  );

  const unwatchMatch = useCallback(
    (id: string | number) => {
      // eslint-disable-next-line eqeqeq
      if (activeMatchId == id) {
        setActiveMatchId(null);
        latestMatchIdRef.current = null;
        setCommentary([]);
        setIsCommentaryLoading(false);
      }
    },
    [activeMatchId]
  );

  return {
    matches,
    isLoading,
    error,
    commentary,
    isCommentaryLoading,
    wsError,
    status,
    activeMatchId,
    subscribedMatchIds,
    toggleSubscription,
    subscribeMatch,
    unsubscribeMatch,
    newMatchesCount,
    dismissNewMatches,
    watchMatch,
    unwatchMatch,
    reloadMatches: loadMatches,
  };
};
