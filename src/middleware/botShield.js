// Lightweight heuristic bot filter — not a substitute for a real
// challenge-based service, but catches the majority of scripted abuse.

const BLOCKED_UA_PATTERNS = [
  /curl/i, /wget/i, /python-requests/i, /axios\/0/i,
  /scrapy/i, /go-http-client/i, /libwww-perl/i, /bot/i, /spider/i, /crawler/i,
];

// Allow legitimate bots you actually want, e.g. your own health checks,
// by exempting specific known-good UAs or an API key header here.
export function botShield(req, res, next) {
  const ua = req.get('user-agent') || '';

  if (!ua.trim()) {
    return res.status(403).json({ error: 'Request blocked: missing User-Agent.' });
  }

  if (BLOCKED_UA_PATTERNS.some((pattern) => pattern.test(ua))) {
    return res.status(403).json({ error: 'Request blocked: automated client detected.' });
  }

  next();
}