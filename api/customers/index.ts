import { getSessionUserFromRequest } from '../_auth.js';
import { ensureSchema, pool } from '../_db.js';

type Req = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (code: number) => { json: (body: unknown) => void };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type RevenueEntryPayload = {
  label: string;
  totalRevenue: number;
  carRevenue: number;
  saleDate: string;
  startDate: string;
  payoutDate: string;
};

function toIsoDay(value: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function customerMetaPayload(body: Record<string, unknown>) {
  return {
    nordigoId: String(body.nordigoId ?? '').trim(),
    navn: String(body.navn ?? '').trim() || null,
    email: String(body.email ?? '').trim() || null,
    telefon: String(body.telefon ?? '').trim() || null,
    status: String(body.status ?? 'oprettelse'),
    friKundeChurn: Boolean(body.friKundeChurn ?? false),
    noter: String(body.noter ?? '').trim() || null,
    legacySaleDate: String(body.salgsDato ?? ''),
    legacyStartDate: String(body.opstartsDato ?? ''),
    legacyPayoutDate: String(body.udbetalingsDato ?? ''),
    legacyTotalRevenue: Number(body.samletOmsaetning ?? 0),
    legacyCarRevenue: Number(body.bilOmsaetning ?? 0),
  };
}

function parseRevenueEntries(body: Record<string, unknown>): RevenueEntryPayload[] {
  const raw = body.revenueEntries;
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
      totalRevenue: Number(body.samletOmsaetning ?? 0),
      carRevenue: Number(body.bilOmsaetning ?? 0),
      saleDate: String(body.salgsDato ?? ''),
      startDate: String(body.opstartsDato ?? ''),
      payoutDate: String(body.udbetalingsDato ?? ''),
    },
  ];
}

function validateEntries(entries: RevenueEntryPayload[]): string | null {
  if (entries.length === 0) return 'Mindst én revenue entry er påkrævet';
  for (const entry of entries) {
    if (!ISO_DAY_RE.test(entry.saleDate)) return 'Ugyldig salgsdato';
    if (!ISO_DAY_RE.test(entry.startDate)) return 'Ugyldig opstartsdato';
    if (!ISO_DAY_RE.test(entry.payoutDate)) return 'Ugyldig udbetalingsdato';
    if (!Number.isFinite(entry.totalRevenue) || entry.totalRevenue < 0) {
      return 'Samlet omsætning skal være >= 0';
    }
    if (!Number.isFinite(entry.carRevenue) || entry.carRevenue < 0) {
      return 'Bil omsætning skal være >= 0';
    }
    if (entry.carRevenue > entry.totalRevenue) {
      return 'Bil omsætning kan ikke være større end samlet omsætning';
    }
  }
  return null;
}

function rowToCustomer(
  row: Record<string, unknown>,
  entries: Record<string, unknown>[],
) {
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
    id: String(row.id),
    nordigoId: String(row.nordigo_id),
    navn: row.navn ? String(row.navn) : undefined,
    email: row.email ? String(row.email) : undefined,
    telefon: row.telefon ? String(row.telefon) : undefined,
    salgsDato: first?.saleDate ?? toIsoDay(row.salgs_dato),
    opstartsDato: first?.startDate ?? toIsoDay(row.opstarts_dato),
    udbetalingsDato: first?.payoutDate ?? toIsoDay(row.udbetalings_dato),
    samletOmsaetning: revenueEntries.reduce((sum, entry) => sum + entry.totalRevenue, 0),
    bilOmsaetning: revenueEntries.reduce((sum, entry) => sum + entry.carRevenue, 0),
    status: String(row.status),
    friKundeChurn: Boolean(row.fri_kunde_churn),
    noter: row.noter ? String(row.noter) : undefined,
    oprettetAt: new Date(String(row.oprettet_at)).toISOString(),
    revenueEntries,
  };
}

async function ensureLegacyEntries(userId: string): Promise<void> {
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

export default async function handler(req: Req, res: Res): Promise<void> {
  try {
    await ensureSchema();
    const user = await getSessionUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (req.method === 'GET') {
      await ensureLegacyEntries(user.id);
      const result = await pool.query(
        `
        SELECT id, nordigo_id, navn, email, telefon, salgs_dato, opstarts_dato,
               udbetalings_dato, samlet_omsaetning, bil_omsaetning, status,
               fri_kunde_churn, noter, oprettet_at
        FROM customers
        WHERE user_id = $1
        ORDER BY oprettet_at DESC
        `,
        [user.id],
      );
      const ids = result.rows.map((row) => String(row.id));
      const entriesResult =
        ids.length === 0
          ? { rows: [] as Record<string, unknown>[] }
          : await pool.query(
              `
              SELECT id, customer_id, label, total_revenue, car_revenue, sale_date, start_date, payout_date
              FROM customer_revenue_entries
              WHERE customer_id = ANY($1::uuid[])
              ORDER BY created_at ASC
              `,
              [ids],
            );
      const entryMap = new Map<string, Record<string, unknown>[]>();
      for (const row of entriesResult.rows) {
        const key = String(row.customer_id);
        const current = entryMap.get(key) ?? [];
        current.push(row);
        entryMap.set(key, current);
      }
      res
        .status(200)
        .json({
          customers: result.rows.map((row) =>
            rowToCustomer(row, entryMap.get(String(row.id)) ?? []),
          ),
        });
      return;
    }

    if (req.method === 'POST') {
      const body = isRecord(req.body) ? req.body : {};
      const payload = customerMetaPayload(body);
      const entries = parseRevenueEntries(body);
      if (!payload.nordigoId) {
        res.status(400).json({ error: 'Nordigo-ID er påkrævet' });
        return;
      }
      const validationError = validateEntries(entries);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
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
          user.id,
          payload.nordigoId,
          payload.navn,
          payload.email,
          payload.telefon,
          payload.legacySaleDate,
          payload.legacyStartDate,
          payload.legacyPayoutDate,
          payload.legacyTotalRevenue,
          payload.legacyCarRevenue,
          payload.status,
          payload.friKundeChurn,
          payload.noter,
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
      res
        .status(201)
        .json({ customer: rowToCustomer(created.rows[0], createdEntries.rows) });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
