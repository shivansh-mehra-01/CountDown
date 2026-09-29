import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB } from './backend/db/connection.js';
import { getCountdownState, setCountdownState } from './backend/services/countdownService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// --- API ROUTES ---

app.get('/api/countdown', async (req, res) => {
  const state = await getCountdownState();
  if (state) {
    res.json({ ...state, serverNow: Date.now() });
  } else {
    res.json(null);
  }
});

app.post('/api/countdown/set', async (req, res) => {
  const { durationMs } = req.body;
  if (!durationMs || typeof durationMs !== 'number') {
    return res.status(400).json({ error: 'Valid durationMs is required' });
  }

  const startedAt = Date.now();
  const endAt = startedAt + durationMs;
  
  const newState = {
    phase: 'COUNTDOWN_24H',
    status: 'RUNNING',
    startedAt,
    endAt,
    durationMs,
  };

  await setCountdownState(newState);
  res.json({ ...newState, serverNow: Date.now() });
});

app.post('/api/countdown/reset', async (req, res) => {
  const cinematicStartedAt = Date.now();
  const cinematicDuration = 25600; // 25.6 seconds
  
  const durationMs = 24 * 60 * 60 * 1000; // 24 Hours
  const startedAt = cinematicStartedAt + cinematicDuration;
  const endAt = startedAt + durationMs;

  const newState = {
    phase: 'CLOSED', // This signifies the cinematic intro needs to play globally
    status: 'RUNNING',
    cinematicStartedAt,
    startedAt,
    endAt,
    durationMs,
  };
  
  await setCountdownState(newState);
  res.json({ success: true, ...newState, serverNow: Date.now() });
});

// --- SERVE STATIC FRONTEND ---
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.use((req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start server and connect to MongoDB
app.listen(PORT, '0.0.0.0', async () => {
  await connectDB();
  console.log(`Server running on port ${PORT}`);
});
