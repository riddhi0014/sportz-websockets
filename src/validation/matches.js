import { z } from 'zod';

// Constant for match statuses
export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
};

// Schema to validate query parameters for listing matches
export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Schema to validate match ID parameter
export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Schema to validate creating a match
export const createMatchSchema = z.object({
  sport: z.string().nonempty('Sport is required'),
  homeTeam: z.string().nonempty('Home team is required'),
  awayTeam: z.string().nonempty('Away team is required'),
  startTime: z.string().refine(
    (value) => !isNaN(Date.parse(value)),
    { message: 'Start time must be a valid ISO date string' }
  ),
  endTime: z.string().refine(
    (value) => !isNaN(Date.parse(value)),
    { message: 'End time must be a valid ISO date string' }
  ),
  homeScore: z.coerce.number().int().nonnegative().optional(),
  awayScore: z.coerce.number().int().nonnegative().optional(),
}).superRefine((data, ctx) => {
  if (data.startTime && data.endTime && new Date(data.startTime) >= new Date(data.endTime)) {
    ctx.addIssue({
      path: ['endTime'],
      message: 'End time must be after start time',
    });
  }
});

// Schema to validate updating scores
export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});