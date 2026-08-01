import { z } from 'zod';

// Match status constants
export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
};

// Validate query parameters
export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Validate route parameter
export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Validate request body for creating a match
export const createMatchSchema = z
  .object({
    sport: z.string().min(1, 'Sport is required'),

    homeTeam: z.string().min(1, 'Home team is required'),

    awayTeam: z.string().min(1, 'Away team is required'),

    startTime: z.string().refine(
      (value) => !Number.isNaN(Date.parse(value)),
      {
        message: 'Start time must be a valid ISO date string',
      }
    ),

    endTime: z.string().refine(
      (value) => !Number.isNaN(Date.parse(value)),
      {
        message: 'End time must be a valid ISO date string',
      }
    ),

    homeScore: z.coerce.number().int().nonnegative().optional(),

    awayScore: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.startTime) >= new Date(data.endTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'End time must be after start time',
      });
    }
  });

// Validate score updates
export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});