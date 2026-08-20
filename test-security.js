import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function runSecurityTests() {
  console.log('\n======================================================');
  console.log('       🛡️  SPORTZ SECURITY & SAFETY TEST SUITE       ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASSED: ${message}`);
      passed++;
    } else {
      console.log(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Bot Shield (User-Agent Filtering)
  // ----------------------------------------------------
  console.log('📌 Test Group 1: Bot Detection & Defense (botShield)');

  // 1.1 Blocked Bot UA (curl/python)
  try {
    const res = await fetch(`${BASE_URL}/matches`, {
      headers: { 'User-Agent': 'curl/7.88.1' },
    });
    assert(res.status === 403, 'Blocked request with automated tool User-Agent (curl)');
  } catch (e) {
    console.log('  ❌ FAILED: Bot test request error:', e.message);
  }

  // 1.2 Missing UA
  try {
    const res = await fetch(`${BASE_URL}/matches`, {
      headers: { 'User-Agent': '' },
    });
    assert(res.status === 403, 'Blocked request with missing User-Agent header');
  } catch (e) {
    console.log('  ❌ FAILED: Missing UA test error:', e.message);
  }

  // 1.3 Valid Browser UA
  try {
    const res = await fetch(`${BASE_URL}/matches`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    });
    assert(res.status === 200, 'Allowed legitimate browser User-Agent request');
  } catch (e) {
    console.log('  ❌ FAILED: Browser UA test error:', e.message);
  }

  console.log('');

  // ----------------------------------------------------
  // TEST 2: Zod Input Validation & Schema Security
  // ----------------------------------------------------
  console.log('📌 Test Group 2: Zod Schema Validation & Input Sanitization');

  // 2.1 Invalid End Time (endTime before startTime)
  try {
    const res = await fetch(`${BASE_URL}/matches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      body: JSON.stringify({
        sport: 'Soccer',
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        startTime: '2026-08-21T12:00:00Z',
        endTime: '2026-08-21T10:00:00Z', // invalid: end before start
      }),
    });
    assert(res.status === 400, 'Rejected match payload with endTime earlier than startTime');
  } catch (e) {
    console.log('  ❌ FAILED: Invalid time validation error:', e.message);
  }

  // 2.2 Negative Score Validation
  try {
    const res = await fetch(`${BASE_URL}/matches/1/score`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      body: JSON.stringify({
        homeScore: -5,
        awayScore: 0,
      }),
    });
    assert(res.status === 400, 'Rejected negative score payload');
  } catch (e) {
    console.log('  ❌ FAILED: Negative score validation error:', e.message);
  }

  console.log('');

  // ----------------------------------------------------
  // TEST 3: WebSocket Connection Limit per IP (Max 5)
  // ----------------------------------------------------
  console.log('📌 Test Group 3: WebSocket IP Rate Limiting (Max 5 Connections)');

  const sockets = [];
  let connectionLimitTriggered = false;

  try {
    // Open 5 valid connections
    for (let i = 1; i <= 5; i++) {
      const socket = new WebSocket(WS_URL);
      sockets.push(socket);
    }
    await delay(1000);

    // Attempt 6th connection (should be closed by server with code 1008)
    const extraSocket = new WebSocket(WS_URL);
    await new Promise((resolve) => {
      extraSocket.on('close', (code, reason) => {
        if (code === 1008) {
          connectionLimitTriggered = true;
        }
        resolve();
      });
      extraSocket.on('open', () => {
        setTimeout(resolve, 500);
      });
    });

    assert(connectionLimitTriggered, 'Closed 6th concurrent WebSocket connection from same IP with code 1008');

    // Cleanup sockets
    sockets.forEach((s) => s.close());
    extraSocket.close();
  } catch (e) {
    console.log('  ❌ FAILED: WS limit test error:', e.message);
  }

  console.log('');

  // ----------------------------------------------------
  // TEST 4: REST Write Rate Limiting (Strict Write Limiter)
  // ----------------------------------------------------
  console.log('📌 Test Group 4: Write Operation Rate Limiter (writeLimiter)');

  let rateLimitExceeded = false;
  try {
    // Send 12 rapid write requests to trigger rate limit (limit is 10/min)
    for (let i = 0; i < 12; i++) {
      const res = await fetch(`${BASE_URL}/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
        body: JSON.stringify({
          sport: 'Tennis',
          homeTeam: `Team ${i}`,
          awayTeam: `Team ${i + 100}`,
          startTime: '2026-08-21T10:00:00Z',
          endTime: '2026-08-21T12:00:00Z',
        }),
      });

      if (res.status === 429) {
        rateLimitExceeded = true;
        break;
      }
    }

    assert(rateLimitExceeded, 'Triggered HTTP 429 Too Many Requests on exceeding write limit');
  } catch (e) {
    console.log('  ❌ FAILED: Write rate limit test error:', e.message);
  }

  console.log('\n======================================================');
  console.log(`📊 SECURITY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');
}

runSecurityTests().catch(console.error);
