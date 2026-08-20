import { Router } from 'express';
import { db } from '../db/db.js';
import { matches } from '../db/schema.js';
import {
  createMatchSchema,
  listMatchesQuerySchema,
  updateScoreSchema,
  matchIdParamSchema,
} from '../validation/matches.js';
import { getMatchStatus, isMatchExpired } from '../utils/match-status.js';
import { desc, eq } from 'drizzle-orm';
import { writeLimiter } from '../middleware/rateLimit.js';
import { commentaryRouter } from './commentary.js';

export const matchesRouter = Router();

const MAX_LIMIT = 100;

matchesRouter.get('/', async (req, res) => {

  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid query parameters', details: JSON.stringify(parsed.error.issues) });
  }

  const limit = Math.min(parsed.data.limit ?? 10, MAX_LIMIT);

  try {
    const rawMatches = await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(limit);

    const updatedMatches = await Promise.all(
      rawMatches.map(async (match) => {
        const dynamicStatus = getMatchStatus(match.startTime, match.endTime);
        if (dynamicStatus && dynamicStatus !== match.status) {
          try {
            await db.update(matches).set({ status: dynamicStatus }).where(eq(matches.id, match.id));
            return { ...match, status: dynamicStatus };
          } catch {
            return match;
          }
        }
        return match;
      })
    );

    // Filter out matches that ended more than 5 minutes ago
    const now = new Date();
    const data = updatedMatches.filter((match) => !isMatchExpired(match, now));

    res.json({ data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch matches.', details: e.message });
  }
});


matchesRouter.post('/', writeLimiter, async (req, res) => {

  const parsed = createMatchSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: JSON.stringify(parsed.error.issues) });
  }

  const { startTime, endTime, homeScore, awayScore } = parsed.data;

  try {
    const [event] = await db.insert(matches).values({
      ...parsed.data,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      homeScore: homeScore ?? 0,
      awayScore: awayScore ?? 0,
      status: getMatchStatus(startTime, endTime)
    }
    ).returning();

    if (req.app.locals.broadcastMatchCreated) {
      req.app.locals.broadcastMatchCreated(event);
    }

    res.status(201).json({ data: event });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create match.', details: e.message });
  }

})


matchesRouter.patch('/:id/score', writeLimiter, async (req, res) => {
  const paramsResult = matchIdParamSchema.safeParse(req.params);
  if (!paramsResult.success) {
    return res.status(400).json({ error: 'Invalid match ID.', details: paramsResult.error.issues });
  }

  const bodyResult = updateScoreSchema.safeParse(req.body);
  if (!bodyResult.success) {
    return res.status(400).json({ error: 'Invalid score payload.', details: bodyResult.error.issues });
  }

  try {
    const [updated] = await db.update(matches)
      .set(bodyResult.data)
      .where(eq(matches.id, paramsResult.data.id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Match not found.' });
    }

    if (req.app.locals.broadcastScoreUpdate) {
      req.app.locals.broadcastScoreUpdate(updated.id, {
        homeScore: updated.homeScore,
        awayScore: updated.awayScore,
      });
    }

    res.status(200).json({ data: updated });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update score.', details: e.message });
  }
});


matchesRouter.use('/:id/commentary', commentaryRouter);