import rateLimit from 'express-rate-limit';

// General limiter for all API traffic
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100,           // 100 requests/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again shortly.' },
});

// Stricter limiter for write operations (match creation)
export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,            // 10 writes/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many write requests, slow down.' },
});