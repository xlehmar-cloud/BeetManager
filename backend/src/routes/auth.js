import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_EXPIRY = '7d';

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body || {};

  if (!isValidEmail(email) || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      error: 'Bitte eine gültige E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen angeben.',
    });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'Für diese E-Mail-Adresse existiert bereits ein Konto.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(email, passwordHash);

  const token = signToken(result.lastInsertRowid);
  res.status(201).json({ token, user: { id: result.lastInsertRowid, email } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: 'E-Mail-Adresse oder Passwort ist falsch.' });
  }

  const valid = await bcrypt.compare(password || '', user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'E-Mail-Adresse oder Passwort ist falsch.' });
  }

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, email: user.email } });
});

export default router;
