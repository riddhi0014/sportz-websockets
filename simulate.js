import 'dotenv/config';

const API_BASE = 'http://localhost:8000';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const DEMO_COMMENTARIES = [
  { eventType: 'Pass', message: 'Crisp passing sequence in midfield, building up the attack.' },
  { eventType: 'Shot', message: 'Powerful shot from outside the box! Saved by the keeper!' },
  { eventType: 'Foul', message: 'Tactical foul near the halfway line to stop the counter.' },
  { eventType: 'Goal', message: 'GOAL! Sensational finish into the top corner!', scoreHomeDelta: 1 },
  { eventType: 'Corner', message: 'Inswinging corner kick cleared away by the defense.' },
  { eventType: 'Goal', message: 'GOAL! Equalizer! Magnificent header from the cross!', scoreAwayDelta: 1 },
  { eventType: 'Yellow Card', message: 'Yellow card shown for a late sliding tackle.' },
  { eventType: 'Offside', message: 'Flag is raised for offside as the striker broke free.' },
  { eventType: 'Save', message: 'What a miraculous reflex save by the goalkeeper!' },
  { eventType: 'Goal', message: 'GOAL! Counter-attack executed to perfection!', scoreHomeDelta: 1 },
];

async function simulate() {
  console.log('\n==================================================');
  console.log('      🏆 REAL-TIME SPORTS DASHBOARD SIMULATOR     ');
  console.log('==================================================\n');

  // 1. Fetch current matches
  let res = await fetch(`${API_BASE}/matches`);
  let json = await res.json();
  let matches = json.data || [];

  if (matches.length === 0) {
    console.log('➕ No existing matches found. Creating live demo matches...\n');
    const demoMatches = [
      {
        sport: 'Football',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        homeScore: 0,
        awayScore: 0,
      },
      {
        sport: 'Basketball',
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        homeScore: 84,
        awayScore: 82,
      },
    ];

    for (const matchPayload of demoMatches) {
      const matchRes = await fetch(`${API_BASE}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchPayload),
      });
      const created = await matchRes.json();
      matches.push(created.data);
    }
  }

  console.log('📌 AVAILABLE MATCHES ON DASHBOARD:');
  matches.forEach((m) => {
    console.log(`   👉 Match ID: ${m.id} | ${m.homeTeam} vs ${m.awayTeam} (${m.sport.toUpperCase()})`);
  });

  const activeMatch = matches[0];
  console.log(`\n🎯 TARGET MATCH FOR LIVE COMMENTARY: Match ID ${activeMatch.id} (${activeMatch.homeTeam} vs ${activeMatch.awayTeam})`);
  console.log('💡 INSTRUCTION: Open http://localhost:3000 in your browser and click "Watch Live" on Match ID ' + activeMatch.id + '!\n');
  console.log('--------------------------------------------------');
  console.log('⚡ Pushing real-time WebSocket events every 3 seconds...\n');

  let homeScore = activeMatch.homeScore || 0;
  let awayScore = activeMatch.awayScore || 0;
  let minute = 15;

  for (let i = 0; i < 15; i++) {
    await delay(3000); // 3 seconds between live updates
    minute += Math.floor(Math.random() * 4) + 1;

    const template = DEMO_COMMENTARIES[i % DEMO_COMMENTARIES.length];

    if (template.scoreHomeDelta) homeScore += template.scoreHomeDelta;
    if (template.scoreAwayDelta) awayScore += template.scoreAwayDelta;

    // 1. Push Score Update (if score changed)
    if (template.scoreHomeDelta || template.scoreAwayDelta) {
      console.log(`⚽ [Score Update] Match ${activeMatch.id}: ${activeMatch.homeTeam} ${homeScore} - ${awayScore} ${activeMatch.awayTeam}`);
      await fetch(`${API_BASE}/matches/${activeMatch.id}/score`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeScore, awayScore }),
      });
    }

    // 2. Push Live Commentary
    const actorName = (i % 2 === 0) ? activeMatch.homeTeam + ' Player' : activeMatch.awayTeam + ' Player';
    const teamName = (i % 2 === 0) ? activeMatch.homeTeam : activeMatch.awayTeam;

    console.log(`🎙️  [Commentary ${minute}'] Match ${activeMatch.id}: ${template.message}`);

    await fetch(`${API_BASE}/matches/${activeMatch.id}/commentary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        minute,
        sequence: i + 1,
        period: minute > 45 ? '2nd Half' : '1st Half',
        eventType: template.eventType,
        actor: actorName,
        team: teamName,
        message: template.message,
        tags: [template.eventType.toLowerCase()],
      }),
    });
  }

  console.log('\n==================================================');
  console.log('✅ Real-time simulation complete! Check your browser.');
  console.log('==================================================\n');
}

simulate().catch(console.error);
