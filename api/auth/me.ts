import { ensureSchema } from '../_db.js';
import { getSessionUserFromRequest } from '../_auth.js';

type Req = { method?: string; headers?: Record<string, string | string[] | undefined> };
type Res = {
  status: (code: number) => { json: (body: unknown) => void };
};

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    await ensureSchema();
    const user = await getSessionUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
