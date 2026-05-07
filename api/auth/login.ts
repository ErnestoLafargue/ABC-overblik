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

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    if (rateLimit(`login:${clientKey(req)}`, 15, 10 * 60 * 1000)) {
      res.status(429).json({ error: 'For mange loginforsøg. Prøv igen senere.' });
      return;
    }
    await ensureSchema();
    const body = isRecord(req.body) ? req.body : {};
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    if (!username || !password) {
      res.status(400).json({ error: 'Missing credentials' });
      return;
    }

    const result = await pool.query(
      'SELECT id, username, email, phone, password_hash FROM users WHERE username = $1 LIMIT 1',
      [username],
    );
    const row = result.rows[0] as
      | {
          id: string;
          username: string;
          email: string;
          phone: string;
          password_hash: string;
        }
      | undefined;
    if (!row) {
      res.status(401).json({ error: 'Forkert brugernavn eller kode' });
      return;
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      res.status(401).json({ error: 'Forkert brugernavn eller kode' });
      return;
    }

    const token = await createSession(row.id);
    setSessionCookie(res, token);
    res.status(200).json({
      user: { id: row.id, username: row.username, email: row.email, phone: row.phone },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
