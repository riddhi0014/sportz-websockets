import {Router} from 'express';
import { db } from '../db/db.js';
import { matches } from '../db/schema.js';
import { createMatchSchema, listMatchesQuerySchema } from '../validation/matches.js';
import { getMatchStatus } from '../utils/match-status.js';
import {string } from 'zod';
import { desc } from 'drizzle-orm';


export const matchesRouter = Router();

const MAX_LIMIT=100;

matchesRouter.get('/', async (req, res) => {
  
  const parsed=listMatchesQuerySchema.safeParse(req.query);

  if(!parsed.success){
    return res.status(400).json({error:'Invalid query parameters', details: JSON.stringify(parsed.error.issues)});
  }

  const limit=Math.min(parsed.data.limit ?? 10, MAX_LIMIT);


  try {
    const data=await db.select().from(matches).orderBy(desc(matches.createdAt)).limit(limit);
    
    res.json({ data });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch matches.', details:JSON.stringify(e) });
  }
})


matchesRouter.post('/', async (req, res) => {
  
  const parsed=createMatchSchema.safeParse(req.body);
  const {data: {startTime, endTime, homeScore, awayScore}} = parsed; 
  if(!parsed.success){
    return res.status(400).json({error:'Invalid payload', details: JSON.stringify(parsed.error.issues)});
  }

  try {
    const [event] = await db.insert(matches).values({
      ...parsed.data,
      startTime:new Date(startTime),
      endTime: new Date(endTime),
      homeScore: homeScore ?? 0,
      awayScore: awayScore ?? 0,
      status: getMatchStatus(startTime, endTime)
    }
    ).returning();

    if(req.app.locals.broadcastMatchCreated){
      req.app.locals.broadcastMatchCreated(event);
    }


    res.status(201).json({ data: event });

    

  } catch (e) {
    res.status(500).json({ error: 'Failed to create match.', details:JSON.stringify(e)  });
  }

})