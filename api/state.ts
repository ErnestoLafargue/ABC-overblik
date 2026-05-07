import { ensureSchema, pool } from './_db.js';
import { getSessionUserFromRequest } from './_auth.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default async function handler(
  req: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string | string[] | undefined>;
  },
  res: {
    status: (code: number) => {
      json: (body: unknown) => void;
      send: (body?: string) => void;
    };
    setHeader: (name: string, value: string) => void;
  },
): Promise<void> {
  try {
    await ensureSchema();
    const user = await getSessionUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      const result = await pool.query(
        'SELECT data FROM app_state WHERE user_id = $1',
        [user.id],
      );
      if (result.rowCount === 0) {
        res.status(200).json({ customers: null, settings: null });
        return;
      }
      res.status(200).json(result.rows[0].data);
      return;
    }

    if (req.method === 'PUT') {
      const body = isRecord(req.body) ? req.body : {};
      const customers = body.customers;
      const settings = body.settings;
      if (!Array.isArray(customers) || !isRecord(settings)) {
        res.status(400).json({ error: 'Invalid state payload' });
        return;
      }

      await pool.query(
        `
        INSERT INTO app_state (user_id, data, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
        `,
        [user.id, JSON.stringify({ customers, settings })],
      );

      res.status(204).send('');
      return;
    }

    res.setHeader('Allow', 'GET, PUT');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
