import express from 'express';
import { matchesRouter } from './routes/matches.js';
import http from 'http';
import { attachWebSocketServer } from './ws/server.js';


const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '0.0.0.0';
const app = express();
const server=http.createServer(app);


// Middleware to parse JSON
app.use(express.json());

// Root GET route
app.get('/', (req, res) => {
  res.send({ message: 'Welcome to the Express server!' });
});

app.use('/matches',matchesRouter);

const {broadcastMatchCreated}= attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

// Start the server
server.listen(PORT,HOST, () => {
  const baseUrl = HOST==='0.0.0.0'? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running at ${baseUrl}`);
  console.log(`WebSocket server is running on ${baseUrl.replace('http', 'ws')}/ws`);

}); 