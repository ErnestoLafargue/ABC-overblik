import { createHash, randomBytes } from 'node:crypto';
import { pool } from './_db.js';

export type SessionUser = {
  id: string;
  username: string;
  email: string;
  phone: string;
};

const COOKIE_NAME = 'abc_session';
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 12);

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, entry) => {
    const idx = entry.indexOf('=');
    if (idx <= 0) return acc;
    const k = entry.slice(0, idx).trim();
    const v = entry.slice(idx + 1).trim();
    acc[k] = decodeURIComponent(v);
    return acc;
  }, {});
}

export function setSessionCookie(
  res: { setHeader: (name: string, value: string) => void },
  token: string,
): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(
      token,
    )}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );
}

export function clearSessionCookie(res: {
  setHeader: (name: string, value: string) => void;
}): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`,
  );
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash(token), expiresAt.toISOString()],
  );
  return token;
}

export async function destroySession(token?: string): Promise<void> {
  if (!token) return;
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
}

export async function getSessionUserFromRequest(req: {
  headers?: Record<string, string | string[] | undefined>;
}): Promise<SessionUser | null> {
  const rawCookie = req.headers?.cookie;
  const cookieHeader = Array.isArray(rawCookie) ? rawCookie[0] : rawCookie;
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
  const result = await pool.query(
    `
    SELECT u.id, u.username, u.email, u.phone
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW()
    LIMIT 1
    `,
    [tokenHash(token)],
  );
  if (result.rowCount === 0) return null;
  return result.rows[0] as SessionUser;
}
