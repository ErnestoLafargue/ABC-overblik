import {
  clearSessionCookie,
  destroySession,
  parseCookies,
} from '../_auth.js';
import { ensureSchema } from '../_db.js';

type Req = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (code: number) => { json: (body: unknown) => void };
  setHeader: (name: string, value: string) => void;
};

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await ensureSchema();
    const cookie = req.headers?.cookie;
    const cookieHeader = Array.isArray(cookie) ? cookie[0] : cookie;
    const token = parseCookies(cookieHeader).abc_session;
    await destroySession(token);
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
