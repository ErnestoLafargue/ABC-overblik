import bcrypt from 'bcryptjs';
import { createSession, setSessionCookie } from '../_auth.js';
import { ensureSchema, pool } from '../_db.js';
import { clientKey, rateLimit } from '../_rateLimit.js';

type Req = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (code: number) => { json: (body: unknown) => void };
  setHeader: (name: string, value: string) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d()\s-]{6,20}$/;

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    if (rateLimit(`signup:${clientKey(req)}`, 10, 10 * 60 * 1000)) {
      res.status(429).json({ error: 'For mange forsøg. Prøv igen senere.' });
      return;
    }
    await ensureSchema();
    const body = isRecord(req.body) ? req.body : {};
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const confirmPassword = String(body.confirmPassword ?? '');
    const email = String(body.email ?? '').trim().toLowerCase();
    const phone = String(body.phone ?? '').trim();

    if (!username || !password || !confirmPassword || !email || !phone) {
      res.status(400).json({ error: 'Alle felter er påkrævet' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Adgangskode skal være mindst 8 tegn' });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Adgangskoder matcher ikke' });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'Ugyldig email-adresse' });
      return;
    }
    if (!PHONE_RE.test(phone)) {
      res.status(400).json({ error: 'Ugyldigt telefonnummer' });
      return;
    }

    const exists = await pool.query(
      'SELECT 1 FROM users WHERE username = $1 LIMIT 1',
      [username],
    );
    if (exists.rowCount > 0) {
      res.status(409).json({ error: 'Brugernavn er allerede i brug' });
      return;
    }

    const hash = await bcrypt.hash(password, 12);
    const created = await pool.query(
      `
      INSERT INTO users (username, password_hash, email, phone)
      VALUES ($1, $2, $3, $4)
      RETURNING id, username, email, phone
      `,
      [username, hash, email, phone],
    );
    const user = created.rows[0] as {
      id: string;
      username: string;
      email: string;
      phone: string;
    };

    const token = await createSession(user.id);
    setSessionCookie(res, token);
    res.status(201).json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
