import type { Customer } from '../types';
import { defaultOpstartsDato, udbetalingsFromOpstart } from './dates';

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function withDates(salgsDaysAgo: number) {
  const salgsDato = daysAgo(salgsDaysAgo);
  const opstartsDato = defaultOpstartsDato(salgsDato);
  return {
    salgsDato,
    opstartsDato,
    udbetalingsDato: udbetalingsFromOpstart(opstartsDato),
  };
}

export function seedCustomers(): Customer[] {
  const now = new Date().toISOString();
  const rows: Omit<Customer, 'revenueEntries'>[] = [
    {
      id: 'seed-1',
      nordigoId: 'NRD-1042',
      navn: 'Mette S\u00f8rensen',
      email: 'mette@bagerietnord.dk',
      telefon: '+45 22 11 33 44',
      ...withDates(2),
      samletOmsaetning: 24000,
      bilOmsaetning: 0,
      status: 'godkendt',
      friKundeChurn: false,
      noter: 'Glad kunde, mulig opsalg p\u00e5 erhvervsforsikring.',
      oprettetAt: now,
    },
    {
      id: 'seed-2',
      nordigoId: 'NRD-1043',
      navn: 'Peter Lund Hansen',
      email: 'peter@lundbyg.dk',
      telefon: '+45 31 22 44 55',
      ...withDates(5),
      samletOmsaetning: 18500,
      bilOmsaetning: 12000,
      status: 'oprettelse',
      friKundeChurn: false,
      noter: 'Mangler underskrift p\u00e5 dokument 3.',
      oprettetAt: now,
    },
    {
      id: 'seed-3',
      nordigoId: 'NRD-1044',
      navn: 'Anna Kristensen',
      email: 'anna.k@gmail.com',
      ...withDates(8),
      samletOmsaetning: 9800,
      bilOmsaetning: 9800,
      status: 'godkendt',
      friKundeChurn: false,
      oprettetAt: now,
    },
    {
      id: 'seed-4',
      nordigoId: 'NRD-1045',
      navn: 'Jens Olsen',
      email: 'jens@olsenvvs.dk',
      ...withDates(12),
      samletOmsaetning: 32000,
      bilOmsaetning: 8000,
      status: 'afvist',
      friKundeChurn: false,
      noter: 'Kreditvurdering ikke godkendt.',
      oprettetAt: now,
    },
    {
      id: 'seed-5',
      nordigoId: 'NRD-1046',
      navn: 'Sofie Mikkelsen',
      email: 'sofie.m@outlook.com',
      ...withDates(15),
      samletOmsaetning: 45000,
      bilOmsaetning: 0,
      status: 'godkendt',
      friKundeChurn: true,
      noter: 'Fri kunde fra konkurrenten.',
      oprettetAt: now,
    },
    {
      id: 'seed-6',
      nordigoId: 'NRD-1030',
      navn: 'Lars Bach',
      telefon: '+45 40 55 66 77',
      ...withDates(38),
      samletOmsaetning: 7200,
      bilOmsaetning: 7200,
      status: 'godkendt',
      friKundeChurn: false,
      oprettetAt: now,
    },
    {
      id: 'seed-7',
      nordigoId: 'NRD-1031',
      navn: 'Camilla Vestergaard',
      email: 'camilla@vestergaardconsulting.dk',
      ...withDates(42),
      samletOmsaetning: 41000,
      bilOmsaetning: 5000,
      status: 'godkendt',
      friKundeChurn: true,
      noter: 'Fri kunde med god langsigtet potentiale.',
      oprettetAt: now,
    },
    {
      id: 'seed-8',
      nordigoId: 'NRD-1099',
      navn: 'Henrik Nielsen',
      email: 'henrik@nielsentransport.dk',
      ...withDates(1),
      samletOmsaetning: 22000,
      bilOmsaetning: 14000,
      status: 'oprettelse',
      friKundeChurn: false,
      noter: 'Skal sende endelig pris i morgen.',
      oprettetAt: now,
    },
    {
      id: 'seed-9',
      nordigoId: 'NRD-0998',
      navn: 'Ditte Pedersen',
      email: 'ditte@pedersenco.dk',
      ...withDates(50),
      samletOmsaetning: 6500,
      bilOmsaetning: 0,
      status: 'annulleret',
      friKundeChurn: false,
      noter: 'Ombestemte sig efter en uge.',
      oprettetAt: now,
    },
  ];
  return rows.map((row) => ({
    ...row,
    revenueEntries: [
      {
        id: `${row.id}-entry-1`,
        label: 'Hovedbeløb',
        totalRevenue: row.samletOmsaetning,
        carRevenue: row.bilOmsaetning,
        saleDate: row.salgsDato,
        startDate: row.opstartsDato,
        payoutDate: row.udbetalingsDato,
      },
    ],
  }));
}
