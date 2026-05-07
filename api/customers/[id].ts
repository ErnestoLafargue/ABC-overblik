import { getSessionUserFromRequest } from '../_auth.js';
import { ensureSchema, pool } from '../_db.js';

type Req = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
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

function customerUpdatePayload(body: Record<string, unknown>) {
  return {
    nordigoId: String(body.nordigoId ?? '').trim(),
    navn: String(body.navn ?? '').trim() || null,
    email: String(body.email ?? '').trim() || null,
    telefon: String(body.telefon ?? '').trim() || null,
    salgsDato: String(body.salgsDato ?? ''),
    opstartsDato: String(body.opstartsDato ?? ''),
    udbetalingsDato: String(body.udbetalingsDato ?? ''),
    samletOmsaetning: Number(body.samletOmsaetning ?? 0),
    bilOmsaetning: Number(body.bilOmsaetning ?? 0),
    status: String(body.status ?? 'oprettelse'),
    friKundeChurn: Boolean(body.friKundeChurn ?? false),
    noter: String(body.noter ?? '').trim() || null,
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

function readId(req: Req): string {
  const raw = req.query?.id;
  return Array.isArray(raw) ? raw[0] ?? '' : raw ?? '';
}

export default async function handler(req: Req, res: Res): Promise<void> {
  try {
    await ensureSchema();
    const user = await getSessionUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const id = readId(req);
    if (!id) {
      res.status(400).json({ error: 'Missing customer id' });
      return;
    }

    if (req.method === 'PUT') {
      const body = isRecord(req.body) ? req.body : {};
      const p = customerUpdatePayload(body);
      const entries = parseRevenueEntries(body);
      if (!p.nordigoId) {
        res.status(400).json({ error: 'Nordigo-ID er påkrævet' });
        return;
      }
      const validationError = validateEntries(entries);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
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
        RETURNING id
        `,
        [
          p.nordigoId,
          p.navn,
          p.email,
          p.telefon,
          p.salgsDato,
          p.opstartsDato,
          p.udbetalingsDato,
          p.samletOmsaetning,
          p.bilOmsaetning,
          p.status,
          p.friKundeChurn,
          p.noter,
          id,
          user.id,
        ],
      );
      if (updated.rowCount === 0) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
      await pool.query('DELETE FROM customer_revenue_entries WHERE customer_id = $1', [id]);
      for (const entry of entries) {
        await pool.query(
          `
          INSERT INTO customer_revenue_entries (
            customer_id, label, total_revenue, car_revenue, sale_date, start_date, payout_date
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          `,
          [
            id,
            entry.label,
            entry.totalRevenue,
            entry.carRevenue,
            entry.saleDate,
            entry.startDate,
            entry.payoutDate,
          ],
        );
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const deleted = await pool.query(
        'DELETE FROM customers WHERE id = $1 AND user_id = $2',
        [id, user.id],
      );
      if (deleted.rowCount === 0) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
