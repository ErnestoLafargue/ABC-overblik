import cors from 'cors';
import { createHash, randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import bcrypt from 'bcryptjs';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const app = express();
const port = Number(process.env.API_PORT ?? 8787);
const databaseUrl = process.env.DATABASE_URL;
const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? 12);
const cookieName = 'abc_session';
const rateBuckets = new Map();

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing in environment');
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function parseCookies(header) {
  if (!header) return {};
  return header.split(';').reduce((acc, entry) => {
    const idx = entry.indexOf('=');
    if (idx <= 0) return acc;
    acc[entry.slice(0, idx).trim()] = decodeURIComponent(
      entry.slice(idx + 1).trim(),
    );
    return acc;
  }, {});
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=${encodeURIComponent(
      token,
    )}; Path=/; HttpOnly; SameSite=Lax${secure}`,
  );
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${cookieName}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`,
  );
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0]?.trim() ?? 'unknown';
  return req.headers['x-real-ip'] || 'unknown';
}

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

async function ensureSchema() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nordigo_id TEXT NOT NULL,
      navn TEXT,
      email TEXT,
      telefon TEXT,
      salgs_dato DATE NOT NULL,
      opstarts_dato DATE NOT NULL,
      udbetalings_dato DATE NOT NULL,
      samlet_omsaetning NUMERIC NOT NULL DEFAULT 0,
      bil_omsaetning NUMERIC NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      fri_kunde_churn BOOLEAN NOT NULL DEFAULT FALSE,
      noter TEXT,
      oprettet_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS customer_revenue_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      label TEXT NOT NULL DEFAULT '',
      total_revenue NUMERIC NOT NULL DEFAULT 0,
      car_revenue NUMERIC NOT NULL DEFAULT 0,
      sale_date DATE NOT NULL,
      start_date DATE NOT NULL,
      payout_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_customer_entries_customer_id ON customer_revenue_entries(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_entries_sale_date ON customer_revenue_entries(sale_date);
    CREATE INDEX IF NOT EXISTS idx_customer_entries_payout_date ON customer_revenue_entries(payout_date);

    CREATE TABLE IF NOT EXISTS app_state (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDay(value) {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function parseRevenueEntries(body) {
  const raw = body?.revenueEntries;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter((entry) => isRecord(entry))
      .map((entry, index) => ({
        label: String(entry.label ?? '').trim() || `Beløb ${index + 1}`,
        totalRevenue: Number(entry.totalRevenue ?? 0),
        carRevenue: Number(entry.carRevenue ?? 0),
        saleDate: String(entry.saleDate ?? ''),
        startDate: String(entry.startDate ?? ''),
        payoutDate: String(entry.payoutDate ?? ''),
      }));
  }
  return [
    {
      label: 'Hovedbeløb',
      totalRevenue: Number(body?.samletOmsaetning ?? 0),
      carRevenue: Number(body?.bilOmsaetning ?? 0),
      saleDate: String(body?.salgsDato ?? ''),
      startDate: String(body?.opstartsDato ?? ''),
      payoutDate: String(body?.udbetalingsDato ?? ''),
    },
  ];
}

function validateEntries(entries) {
  if (!entries.length) return 'Mindst én revenue entry er påkrævet';
  for (const entry of entries) {
    if (!ISO_DAY_RE.test(entry.saleDate)) return 'Ugyldig salgsdato';
    if (!ISO_DAY_RE.test(entry.startDate)) return 'Ugyldig opstartsdato';
    if (!ISO_DAY_RE.test(entry.payoutDate)) return 'Ugyldig udbetalingsdato';
    if (!Number.isFinite(entry.totalRevenue) || entry.totalRevenue < 0)
      return 'Samlet omsætning skal være >= 0';
    if (!Number.isFinite(entry.carRevenue) || entry.carRevenue < 0)
      return 'Bil omsætning skal være >= 0';
    if (entry.carRevenue > entry.totalRevenue)
      return 'Bil omsætning kan ikke være større end samlet omsætning';
  }
  return null;
}

async function ensureLegacyEntries(userId) {
  await pool.query(
    `
    INSERT INTO customer_revenue_entries (
      customer_id, label, total_revenue, car_revenue, sale_date, start_date, payout_date
    )
    SELECT
      c.id,
      'Hovedbeløb',
      c.samlet_omsaetning,
      c.bil_omsaetning,
      c.salgs_dato,
      c.opstarts_dato,
      c.udbetalings_dato
    FROM customers c
    WHERE c.user_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM customer_revenue_entries e WHERE e.customer_id = c.id
      )
    `,
    [userId],
  );
}

function rowToCustomer(row, entries) {
  const revenueEntries = entries.map((entry) => ({
    id: String(entry.id),
    label: String(entry.label ?? ''),
    totalRevenue: Number(entry.total_revenue) || 0,
    carRevenue: Number(entry.car_revenue) || 0,
    saleDate: toIsoDay(entry.sale_date),
    startDate: toIsoDay(entry.start_date),
    payoutDate: toIsoDay(entry.payout_date),
  }));
  const first = revenueEntries[0];
  return {
    id: row.id,
    nordigoId: row.nordigo_id,
    navn: row.navn ?? undefined,
    email: row.email ?? undefined,
    telefon: row.telefon ?? undefined,
    salgsDato: first?.saleDate ?? toIsoDay(row.salgs_dato),
    opstartsDato: first?.startDate ?? toIsoDay(row.opstarts_dato),
    udbetalingsDato: first?.payoutDate ?? toIsoDay(row.udbetalings_dato),
    samletOmsaetning: revenueEntries.reduce((sum, entry) => sum + entry.totalRevenue, 0),
    bilOmsaetning: revenueEntries.reduce((sum, entry) => sum + entry.carRevenue, 0),
    status: row.status,
    friKundeChurn: !!row.fri_kunde_churn,
    noter: row.noter ?? undefined,
    oprettetAt: new Date(row.oprettet_at).toISOString(),
    revenueEntries,
  };
}

async function requireAuth(req, res, next) {
  try {
    await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
    const token = parseCookies(req.headers.cookie || '')[cookieName];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const result = await pool.query(
      `
      SELECT u.id, u.username, u.email, u.phone
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()
      LIMIT 1
      `,
      [hashToken(token)],
    );
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = result.rows[0];
    req.sessionToken = token;
    return next();
  } catch (error) {
    return next(error);
  }
}

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
});

app.post('/api/auth/signup', async (req, res) => {
  if (rateLimit(`signup:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'For mange forsøg. Prøv igen senere.' });
  }
  const { username, password, confirmPassword, email, phone } = req.body ?? {};
  if (!username || !password || !confirmPassword || !email || !phone) {
    return res.status(400).json({ error: 'Alle felter er påkrævet' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Adgangskode skal være mindst 8 tegn' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Adgangskoder matcher ikke' });
  }

  const exists = await pool.query(
    'SELECT 1 FROM users WHERE username = $1 LIMIT 1',
    [String(username).trim()],
  );
  if (exists.rowCount > 0) {
    return res.status(409).json({ error: 'Brugernavn er allerede i brug' });
  }

  const hash = await bcrypt.hash(String(password), 12);
  const created = await pool.query(
    `
    INSERT INTO users (username, password_hash, email, phone)
    VALUES ($1, $2, $3, $4)
    RETURNING id, username, email, phone
    `,
    [String(username).trim(), hash, String(email).trim(), String(phone).trim()],
  );
  const user = created.rows[0];
  const token = randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [
      user.id,
      hashToken(token),
      new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000).toISOString(),
    ],
  );
  setSessionCookie(res, token);
  return res.status(201).json({ user });
});

app.post('/api/auth/login', async (req, res) => {
  if (rateLimit(`login:${clientIp(req)}`, 15, 10 * 60 * 1000)) {
    return res
      .status(429)
      .json({ error: 'For mange loginforsøg. Prøv igen senere.' });
  }
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  const result = await pool.query(
    'SELECT id, username, email, phone, password_hash FROM users WHERE username = $1 LIMIT 1',
    [String(username).trim()],
  );
  const row = result.rows[0];
  if (!row) {
    return res.status(401).json({ error: 'Forkert brugernavn eller kode' });
  }
  const ok = await bcrypt.compare(String(password), row.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'Forkert brugernavn eller kode' });
  }
  const token = randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [
      row.id,
      hashToken(token),
      new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000).toISOString(),
    ],
  );
  setSessionCookie(res, token);
  return res.json({
    user: { id: row.id, username: row.username, email: row.email, phone: row.phone },
  });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [
    hashToken(req.sessionToken),
  ]);
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

app.get('/api/settings', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT data FROM user_settings WHERE user_id = $1', [
    req.user.id,
  ]);
  if (result.rowCount === 0) {
    return res.json({ settings: { defaultCommission: {}, monthly: {} } });
  }
  return res.json({ settings: result.rows[0].data });
});

app.put('/api/settings', requireAuth, async (req, res) => {
  const settings = req.body?.settings;
  if (!isRecord(settings)) {
    return res.status(400).json({ error: 'Invalid settings payload' });
  }
  await pool.query(
    `
    INSERT INTO user_settings (user_id, data, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `,
    [req.user.id, JSON.stringify(settings)],
  );
  return res.status(204).send();
});

app.get('/api/customers', requireAuth, async (req, res) => {
  await ensureLegacyEntries(req.user.id);
  const result = await pool.query(
    `
    SELECT id, nordigo_id, navn, email, telefon, salgs_dato, opstarts_dato,
           udbetalings_dato, samlet_omsaetning, bil_omsaetning, status,
           fri_kunde_churn, noter, oprettet_at
    FROM customers
    WHERE user_id = $1
    ORDER BY oprettet_at DESC
    `,
    [req.user.id],
  );
  const ids = result.rows.map((row) => String(row.id));
  const entriesResult =
    ids.length === 0
      ? { rows: [] }
      : await pool.query(
          `
          SELECT id, customer_id, label, total_revenue, car_revenue, sale_date, start_date, payout_date
          FROM customer_revenue_entries
          WHERE customer_id = ANY($1::uuid[])
          ORDER BY created_at ASC
          `,
          [ids],
        );
  const entryMap = new Map();
  for (const row of entriesResult.rows) {
    const key = String(row.customer_id);
    const current = entryMap.get(key) ?? [];
    current.push(row);
    entryMap.set(key, current);
  }
  return res.json({
    customers: result.rows.map((row) =>
      rowToCustomer(row, entryMap.get(String(row.id)) ?? []),
    ),
  });
});

app.post('/api/customers', requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const entries = parseRevenueEntries(body);
  if (!body.nordigoId) {
    return res.status(400).json({ error: 'Nordigo-ID er påkrævet' });
  }
  const validationError = validateEntries(entries);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const created = await pool.query(
    `
    INSERT INTO customers (
      user_id, nordigo_id, navn, email, telefon, salgs_dato, opstarts_dato,
      udbetalings_dato, samlet_omsaetning, bil_omsaetning, status, fri_kunde_churn, noter
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING id, nordigo_id, navn, email, telefon, salgs_dato, opstarts_dato,
              udbetalings_dato, samlet_omsaetning, bil_omsaetning, status,
              fri_kunde_churn, noter, oprettet_at
    `,
    [
      req.user.id,
      body.nordigoId,
      body.navn || null,
      body.email || null,
      body.telefon || null,
      body.salgsDato,
      body.opstartsDato,
      body.udbetalingsDato,
      Number(body.samletOmsaetning ?? 0),
      Number(body.bilOmsaetning ?? 0),
      body.status || 'oprettelse',
      !!body.friKundeChurn,
      body.noter || null,
    ],
  );
  const customerId = String(created.rows[0].id);
  for (const entry of entries) {
    await pool.query(
      `
      INSERT INTO customer_revenue_entries (
        customer_id, label, total_revenue, car_revenue, sale_date, start_date, payout_date
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        customerId,
        entry.label,
        entry.totalRevenue,
        entry.carRevenue,
        entry.saleDate,
        entry.startDate,
        entry.payoutDate,
      ],
    );
  }
  const createdEntries = await pool.query(
    `
    SELECT id, customer_id, label, total_revenue, car_revenue, sale_date, start_date, payout_date
    FROM customer_revenue_entries
    WHERE customer_id = $1
    ORDER BY created_at ASC
    `,
    [customerId],
  );
  return res
    .status(201)
    .json({ customer: rowToCustomer(created.rows[0], createdEntries.rows) });
});

app.put('/api/customers/:id', requireAuth, async (req, res) => {
  const body = req.body ?? {};
  const entries = parseRevenueEntries(body);
  const validationError = validateEntries(entries);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }
  const updated = await pool.query(
    `
    UPDATE customers
    SET nordigo_id = $1,
        navn = $2,
        email = $3,
        telefon = $4,
        salgs_dato = $5,
        opstarts_dato = $6,
        udbetalings_dato = $7,
        samlet_omsaetning = $8,
        bil_omsaetning = $9,
        status = $10,
        fri_kunde_churn = $11,
        noter = $12
    WHERE id = $13 AND user_id = $14
    `,
    [
      body.nordigoId,
      body.navn || null,
      body.email || null,
      body.telefon || null,
      body.salgsDato,
      body.opstartsDato,
      body.udbetalingsDato,
      Number(body.samletOmsaetning ?? 0),
      Number(body.bilOmsaetning ?? 0),
      body.status || 'oprettelse',
      !!body.friKundeChurn,
      body.noter || null,
      req.params.id,
      req.user.id,
    ],
  );
  if (updated.rowCount === 0) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  await pool.query('DELETE FROM customer_revenue_entries WHERE customer_id = $1', [
    req.params.id,
  ]);
  for (const entry of entries) {
    await pool.query(
      `
      INSERT INTO customer_revenue_entries (
        customer_id, label, total_revenue, car_revenue, sale_date, start_date, payout_date
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        req.params.id,
        entry.label,
        entry.totalRevenue,
        entry.carRevenue,
        entry.saleDate,
        entry.startDate,
        entry.payoutDate,
      ],
    );
  }
  return res.json({ ok: true });
});

app.delete('/api/customers/:id', requireAuth, async (req, res) => {
  const deleted = await pool.query(
    'DELETE FROM customers WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id],
  );
  if (deleted.rowCount === 0) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  return res.json({ ok: true });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

await ensureSchema();
app.listen(port, () => {
  console.log(`API listening on http://0.0.0.0:${port}`);
});
