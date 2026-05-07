import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const app = express();
const port = Number(process.env.API_PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing in environment');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const STATE_KEY = 'default';

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.get('/api/state', async (_req, res) => {
  const result = await pool.query('SELECT data FROM app_state WHERE key = $1', [
    STATE_KEY,
  ]);
  if (result.rowCount === 0) {
    return res.json({ customers: null, settings: null });
  }
  return res.json(result.rows[0].data);
});

app.put('/api/state', async (req, res) => {
  const { customers, settings } = req.body ?? {};
  if (!Array.isArray(customers) || !isRecord(settings)) {
    return res.status(400).json({ error: 'Invalid state payload' });
  }

  await pool.query(
    `
    INSERT INTO app_state (key, data, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (key)
    DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `,
    [STATE_KEY, JSON.stringify({ customers, settings })],
  );
  return res.status(204).send();
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

await ensureSchema();
app.listen(port, () => {
  console.log(`API listening on http://0.0.0.0:${port}`);
});
