import { Router } from 'express';
import { db } from '../db/db.js';
import { matches, commentary } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export const simulationRouter = Router();

let simulationInterval = null;
let currentStep = 0;

const SPORT_TEMPLATES = {
  Football: [
    { eventType: 'Pass', message: 'Crisp passing sequence in midfield, building up the attack.' },
    { eventType: 'Shot', message: 'Powerful shot from outside the box! Saved by the keeper!' },
    { eventType: 'Goal', message: 'GOAL! Sensational finish into the top corner!', homeDelta: 1, awayDelta: 0 },
    { eventType: 'Yellow Card', message: 'Yellow card shown for a late sliding tackle.' },
    { eventType: 'Goal', message: 'GOAL! Equalizer! Magnificent header from the corner kick!', homeDelta: 0, awayDelta: 1 },
    { eventType: 'Offside', message: 'Flag is raised for offside as the striker broke free.' },
    { eventType: 'Save', message: 'Miraculous reflex save by the goalkeeper!' },
    { eventType: 'Goal', message: 'GOAL! Counter-attack executed to perfection!', homeDelta: 1, awayDelta: 0 },
  ],
  Basketball: [
    { eventType: '3-Pointer', message: 'BOOM! Deep 3-pointer swished from downtown!', homeDelta: 3, awayDelta: 0 },
    { eventType: 'Steal', message: 'Quick hands! Turnover forced and fast break started.' },
    { eventType: 'Slam Dunk', message: 'MONSTER SLAM DUNK! Rattling the rim!', homeDelta: 2, awayDelta: 0 },
    { eventType: '2-Pointer', message: 'Smooth pull-up jumper off the glass.', homeDelta: 0, awayDelta: 2 },
    { eventType: 'Block', message: 'REJECTED! Huge block at the rim!', homeDelta: 0, awayDelta: 0 },
    { eventType: '3-Pointer', message: 'ANSWERED! Back-to-back 3-pointers!', homeDelta: 0, awayDelta: 3 },
  ],
  Tennis: [
    { eventType: 'Ace', message: 'ACE! Unreturnable 125mph serve out wide.', homeDelta: 1, awayDelta: 0 },
    { eventType: 'Rally', message: '24-shot baseline rally ending with a forehand winner!', homeDelta: 0, awayDelta: 1 },
    { eventType: 'Break Point', message: 'Break point converted with a stunning passing shot!', homeDelta: 1, awayDelta: 0 },
    { eventType: 'Drop Shot', message: 'Delicate drop shot just over the net. Perfect touch!', homeDelta: 0, awayDelta: 1 },
  ],
  Cricket: [
    { eventType: 'SIX', message: 'SIXER! Smacked high over long-on into the stands!', homeDelta: 6, awayDelta: 0 },
    { eventType: 'FOUR', message: 'FOUR! Driven through the covers with impeccable timing!', homeDelta: 4, awayDelta: 0 },
    { eventType: 'WICKET', message: 'OUT! Clean bowled! The off-stump is knocked out of the ground!', homeDelta: 0, awayDelta: 0 },
    { eventType: 'FOUR', message: 'FOUR! Edged past the keeper down to third man.', homeDelta: 0, awayDelta: 4 },
  ],
};

async function seedDemoMatches() {
  // Clear old commentary and matches to ensure a clean demo experience
  await db.delete(commentary);
  await db.delete(matches);

  const now = new Date();

  // 1. Finished match (Ended 2 minutes ago - within 5 min retention window)
  const [finishedMatch] = await db.insert(matches).values({
    sport: 'Football',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    status: 'finished',
    startTime: new Date(now.getTime() - 95 * 60 * 1000),
    endTime: new Date(now.getTime() - 2 * 60 * 1000), // Ended 2 mins ago
    homeScore: 3,
    awayScore: 2,
  }).returning();

  await db.insert(commentary).values([
    {
      matchId: finishedMatch.id,
      minute: 90,
      sequence: 3,
      period: 'Full Time',
      eventType: 'Goal',
      actor: 'Bukayo Saka',
      team: 'Arsenal',
      message: 'FULL TIME! Arsenal wins 3-2 in a dramatic London Derby!',
      tags: ['finished', 'recap'],
    },
    {
      matchId: finishedMatch.id,
      minute: 88,
      sequence: 2,
      period: '2nd Half',
      eventType: 'Goal',
      actor: 'Martin Odegaard',
      team: 'Arsenal',
      message: 'GOAL! Sensational late winner into the top right corner!',
      tags: ['goal'],
    },
    {
      matchId: finishedMatch.id,
      minute: 45,
      sequence: 1,
      period: '1st Half',
      eventType: 'Shot',
      actor: 'Cole Palmer',
      team: 'Chelsea',
      message: 'Half time analysis: Arsenal 1-1 Chelsea. High intensity game.',
      tags: ['halftime'],
    },
  ]);

  // 2. Live Football Match
  const [liveFootball] = await db.insert(matches).values({
    sport: 'Football',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    status: 'live',
    startTime: new Date(now.getTime() - 30 * 60 * 1000),
    endTime: new Date(now.getTime() + 60 * 60 * 1000),
    homeScore: 1,
    awayScore: 1,
  }).returning();

  // 3. Live Basketball Match
  const [liveBasketball] = await db.insert(matches).values({
    sport: 'Basketball',
    homeTeam: 'Lakers',
    awayTeam: 'Warriors',
    status: 'live',
    startTime: new Date(now.getTime() - 20 * 60 * 1000),
    endTime: new Date(now.getTime() + 40 * 60 * 1000),
    homeScore: 92,
    awayScore: 90,
  }).returning();

  // 4. Live Cricket Match
  const [liveCricket] = await db.insert(matches).values({
    sport: 'Cricket',
    homeTeam: 'India',
    awayTeam: 'Australia',
    status: 'live',
    startTime: new Date(now.getTime() - 40 * 60 * 1000),
    endTime: new Date(now.getTime() + 140 * 60 * 1000),
    homeScore: 154,
    awayScore: 148,
  }).returning();

  return [finishedMatch, liveFootball, liveBasketball, liveCricket];
}

simulationRouter.get('/status', (req, res) => {
  res.json({ active: !!simulationInterval });
});

simulationRouter.post('/start', async (req, res) => {
  if (simulationInterval) {
    return res.json({ message: 'Simulation already running', active: true });
  }

  console.log('\n========================================================');
  console.log('🚀 LIVE DEMO ENGINE STARTED (Seeded 4 Fresh Matches)');
  console.log('========================================================');

  const demoMatches = await seedDemoMatches();

  if (req.app.locals.broadcastMatchCreated) {
    demoMatches.forEach((m) => req.app.locals.broadcastMatchCreated(m));
  }

  // Filter only live matches for simulation score updates
  const liveMatchesOnly = demoMatches.filter((m) => m.status === 'live');
  currentStep = 0;

  simulationInterval = setInterval(async () => {
    try {
      if (liveMatchesOnly.length === 0) return;

      // Rotate through live matches sequentially
      const targetMatch = liveMatchesOnly[currentStep % liveMatchesOnly.length];
      const sportName = SPORT_TEMPLATES[targetMatch.sport] ? targetMatch.sport : 'Football';
      const templates = SPORT_TEMPLATES[sportName];
      const template = templates[currentStep % templates.length];
      currentStep++;

      let newHomeScore = targetMatch.homeScore;
      let newAwayScore = targetMatch.awayScore;

      if (template.homeDelta) newHomeScore += template.homeDelta;
      if (template.awayDelta) newAwayScore += template.awayDelta;

      // 1. Update DB & broadcast score update if changed
      if (template.homeDelta || template.awayDelta) {
        const [updated] = await db.update(matches)
          .set({ homeScore: newHomeScore, awayScore: newAwayScore })
          .where(eq(matches.id, targetMatch.id))
          .returning();

        if (updated) {
          targetMatch.homeScore = updated.homeScore;
          targetMatch.awayScore = updated.awayScore;

          if (req.app.locals.broadcastScoreUpdate) {
            req.app.locals.broadcastScoreUpdate(updated.id, {
              homeScore: updated.homeScore,
              awayScore: updated.awayScore,
            });
          }
          console.log(`⚽ [LIVE DEMO SCORE] Match #${updated.id} (${updated.homeTeam} vs ${updated.awayTeam}): ${updated.homeScore} - ${updated.awayScore}`);
        }
      }

      // 2. Insert commentary in DB & broadcast over WebSocket
      const minute = 10 + Math.floor(currentStep * 1.5);
      const isHome = currentStep % 2 === 0;
      const team = isHome ? targetMatch.homeTeam : targetMatch.awayTeam;
      const actor = `${team} Player`;

      const [newCommentary] = await db.insert(commentary).values({
        matchId: targetMatch.id,
        minute,
        sequence: currentStep,
        period: minute > 45 ? '2nd Half' : '1st Half',
        eventType: template.eventType,
        actor,
        team,
        message: template.message,
        tags: [template.eventType.toLowerCase(), targetMatch.sport.toLowerCase()],
      }).returning();

      if (req.app.locals.broadcastCommentary && newCommentary) {
        req.app.locals.broadcastCommentary(targetMatch.id, newCommentary);
      }

      console.log(`🎙️ [LIVE DEMO COMMENTARY] Match #${targetMatch.id} [${minute}']: ${template.message}`);

    } catch (e) {
      console.error('[Demo Engine Error]', e);
    }
  }, 2000); // 2 second frequency for lively dashboard demos

  res.json({ message: 'Simulation started successfully', active: true });
});

simulationRouter.post('/stop', (req, res) => {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log('\n🛑 LIVE DEMO ENGINE STOPPED');
    console.log('========================================================\n');
  }
  res.json({ message: 'Simulation stopped', active: false });
});
