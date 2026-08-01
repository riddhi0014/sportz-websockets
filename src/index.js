import express from 'express';
import { matchesRouter } from './routes/matches.js';

const app = express();
const PORT = 8000;

// Middleware to parse JSON
app.use(express.json());

// Root GET route
app.get('/', (req, res) => {
  res.send({ message: 'Welcome to the Express server!' });
});

app.use('/matches',matchesRouter);



// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});