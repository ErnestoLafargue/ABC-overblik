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
      if (!p.nordigoId) {
        res.status(400).json({ error: 'Nordigo-ID er påkrævet' });
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
