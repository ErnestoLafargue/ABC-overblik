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

function toCustomerRowPayload(body: Record<string, unknown>) {
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

function rowToCustomer(row: Record<string, unknown>) {
  const toIsoDay = (value: unknown) => {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  };

  return {
    id: String(row.id),
    nordigoId: String(row.nordigo_id),
    navn: row.navn ? String(row.navn) : undefined,
    email: row.email ? String(row.email) : undefined,
    telefon: row.telefon ? String(row.telefon) : undefined,
    salgsDato: toIsoDay(row.salgs_dato),
    opstartsDato: toIsoDay(row.opstarts_dato),
    udbetalingsDato: toIsoDay(row.udbetalings_dato),
    samletOmsaetning: Number(row.samlet_omsaetning) || 0,
    bilOmsaetning: Number(row.bil_omsaetning) || 0,
    status: String(row.status),
    friKundeChurn: Boolean(row.fri_kunde_churn),
    noter: row.noter ? String(row.noter) : undefined,
    oprettetAt: new Date(String(row.oprettet_at)).toISOString(),
  };
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
      res.status(200).json({ customers: result.rows.map(rowToCustomer) });
      return;
    }

    if (req.method === 'POST') {
      const body = isRecord(req.body) ? req.body : {};
      const payload = toCustomerRowPayload(body);
      if (!payload.nordigoId) {
        res.status(400).json({ error: 'Nordigo-ID er påkrævet' });
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
          payload.salgsDato,
          payload.opstartsDato,
          payload.udbetalingsDato,
          payload.samletOmsaetning,
          payload.bilOmsaetning,
          payload.status,
          payload.friKundeChurn,
          payload.noter,
        ],
      );
      res.status(201).json({ customer: rowToCustomer(created.rows[0]) });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
