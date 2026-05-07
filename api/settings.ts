import { getSessionUserFromRequest } from './_auth.js';
import { ensureSchema, pool } from './_db.js';

type Req = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (code: number) => {
    json: (body: unknown) => void;
    send: (body?: string) => void;
  };
};

const DEFAULT_SETTINGS = {
  defaultCommission: {
    model: 'fuld_provision',
    fixedSalary: 30000,
    churnBonusPct: 5,
    generalPct: 15,
    carPct: 5,
    basePct: 5,
    aboveThresholdPct: 10,
    threshold: 300000,
  },
  monthly: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default async function handler(req: Req, res: Res): Promise<void> {
  try {
    await ensureSchema();
    const user = await getSessionUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      const result = await pool.query(
        'SELECT data FROM user_settings WHERE user_id = $1',
        [user.id],
      );
      if (result.rowCount === 0) {
        res.status(200).json({ settings: DEFAULT_SETTINGS });
        return;
      }
      res.status(200).json({ settings: result.rows[0].data });
      return;
    }

    if (req.method === 'PUT') {
      const body = isRecord(req.body) ? req.body : {};
      const settings = isRecord(body.settings) ? body.settings : null;
      if (!settings) {
        res.status(400).json({ error: 'Invalid settings payload' });
        return;
      }
      await pool.query(
        `
        INSERT INTO user_settings (user_id, data, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
        `,
        [user.id, JSON.stringify(settings)],
      );
      res.status(204).send('');
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
