import { WebSocket } from 'ws';

const URL = 'ws://localhost:8000/ws';
const TOTAL_CONNECTIONS = 6;

for (let i = 1; i <= TOTAL_CONNECTIONS; i++) {
  const ws = new WebSocket(URL);

  ws.on('open', () => {
    console.log(`Connection ${i}: OPENED`);
  });

  ws.on('message', (data) => {
    console.log(`Connection ${i}: message`, data.toString());
  });

  ws.on('close', (code, reason) => {
    console.log(`Connection ${i}: CLOSED — code=${code}, reason=${reason.toString()}`);
  });

  ws.on('error', (err) => {
    console.log(`Connection ${i}: ERROR — ${err.message}`);
  });
}