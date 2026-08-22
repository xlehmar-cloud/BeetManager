import jwt from 'jsonwebtoken';
import { db } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

/**
 * Express-Middleware: prüft den "Authorization: Bearer <token>"-Header,
 * lädt den zugehörigen Benutzer und hängt ihn als req.user an.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(payload.sub);

    if (!user) {
      return res.status(401).json({ error: 'Nicht angemeldet.' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Ungültiges oder abgelaufenes Token.' });
  }
}
