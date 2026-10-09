import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { CONFIG } from './config.js';
import { statusRouter } from './routes/statusRoutes.js';
import { lectureRouter } from './routes/lectureRoutes.js';
import { qnaRouter } from './routes/qnaRoutes.js';

const app = express();

// Ensure local uploads directory exists
if (!fs.existsSync(CONFIG.UPLOADS_DIR)) {
  fs.mkdirSync(CONFIG.UPLOADS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads for local audio playback
app.use('/uploads', express.static(CONFIG.UPLOADS_DIR));

// API Routes
app.use('/api/status', statusRouter);
app.use('/api/lectures', lectureRouter);
app.use('/api/qna', qnaRouter);

// Root health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Lectern Backend Pipeline',
    mode: 'offline',
    timestamp: new Date().toISOString(),
  });
});

app.listen(CONFIG.PORT, () => {
  console.log(`[Lectern Server] Running offline on http://localhost:${CONFIG.PORT}`);
  console.log(`[Lectern Server] Uploads directory: ${CONFIG.UPLOADS_DIR}`);
});
