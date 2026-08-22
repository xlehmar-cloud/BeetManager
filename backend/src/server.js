import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { db } from './db.js';
import { authenticate } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import plantsRouter from './routes/plants.js';
import bedsRouter from './routes/beds.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);

// Beispiel für eine geschützte Route – liefert den aktuell angemeldeten Benutzer.
app.get('/api/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

app.use('/api/plants', plantsRouter);
app.use('/api/beds', bedsRouter);

// Beetübergreifende Übersicht: alle Pflanzungen des Users, gejoint mit Beetname
// (für /kalender im Frontend), optional nach Jahr gefiltert.
app.get('/api/plantings', authenticate, (req, res) => {
  const year = req.query.year ? Number(req.query.year) : null;
  const rows = year
    ? db
        .prepare(
          `SELECT p.*, b.name AS bed_name
           FROM plantings p JOIN beds b ON b.id = p.bed_id
           WHERE b.user_id = ? AND p.year = ?
           ORDER BY p.year, p.month`,
        )
        .all(req.user.id, year)
    : db
        .prepare(
          `SELECT p.*, b.name AS bed_name
           FROM plantings p JOIN beds b ON b.id = p.bed_id
           WHERE b.user_id = ?
           ORDER BY p.year, p.month`,
        )
        .all(req.user.id);
  res.json({ plantings: rows });
});

app.listen(PORT, () => {
  console.log(`Beet-Manager Backend läuft auf http://localhost:${PORT}`);
});
