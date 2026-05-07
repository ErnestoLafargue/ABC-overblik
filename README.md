# ABC-oversigt

En moderne webapp til at holde styr på dine lukkede kunder, deres status (oprettelse / godkendt / afvist), forventet omsætning og din løn.

## Features

- 📊 **Dashboard** med KPI-kort: antal kunder, samlet omsætning, forventet løn, afviste
- 📈 **Grafer**: forventet løn pr. måned + status-fordeling
- 📅 **Kommende opfølgninger** — så du ikke glemmer dem
- 🔍 **Filtrér og søg** kunder på status, navn, email, produkt
- ✏️ **Tilføj/rediger/slet kunder** med fuld formular (status, omsætning, provision, opfølgning, noter)
- 💾 **Auto-gem i browseren** (localStorage) — alt overlever refresh

## Stack

- ⚡ Vite + React 19 + TypeScript
- 🎨 TailwindCSS v4
- 📊 Recharts
- 🎯 lucide-react (ikoner)

## Kom i gang (Neon database)

```bash
npm install
cp .env.example .env
# indsæt din Neon DATABASE_URL i .env
npm run dev:full
```

Åbn så `http://localhost:5173`.
Frontend kører på Vite, og API kører på port `8787`.

## Build

```bash
npm run build
npm run preview
```

## Datamodel

Hver kunde har:

- `navn`, `email`, `telefon`, `produkt`
- `status`: `kladde` | `oprettelse` | `godkendt` | `afvist` | `annulleret`
- `lukketDato`, `godkendtDato`, `afvistDato`, `afvistGrund`
- `omsaetning` (DKK) og `provisionPct` (%) — bruges til at beregne din løn
- `opfoelgningDato`, `noter`

Data gemmes i Neon Postgres via API'en (`/api/state`).

## Næste skridt (idéer)

- [ ] Eksport til CSV / Excel
- [ ] Backend (Postgres / Supabase) i stedet for localStorage
- [ ] Kobling til Allio-Leads
- [ ] Login / multi-bruger
- [ ] Mål for månedlig løn + progress bar
