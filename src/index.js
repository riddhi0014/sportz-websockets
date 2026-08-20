import express from 'express';
import { matchesRouter } from './routes/matches.js';
import http from 'http';
import { attachWebSocketServer } from './ws/server.js';
import { generalLimiter } from './middleware/rateLimit.js';
import { botShield } from './middleware/botShield.js';
import cors from 'cors';


const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '0.0.0.0';
const app = express();
const server=http.createServer(app);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
}));
// Middleware to parse JSON
app.use(express.json());

app.use(botShield);
app.use(generalLimiter);

// Root GET route
app.get('/', (req, res) => {
  res.send({ message: 'Welcome to the Express server!' });
});


app.use('/matches',matchesRouter);


const {broadcastMatchCreated, broadcastCommentary}= attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

// Start the server
server.listen(PORT,HOST, () => {
  const baseUrl = HOST==='0.0.0.0'? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running at ${baseUrl}`);
  console.log(`WebSocket server is running on ${baseUrl.replace('http', 'ws')}/ws`);

}); 