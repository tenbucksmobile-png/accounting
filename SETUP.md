# Tenbucks Accounting — Setup

## 1. Create a Supabase Project

1. Go to supabase.com → New project
2. Name it `tenbucks-accounting`
3. Choose a strong database password (save it)
4. Region: South Africa / Europe (closest)

## 2. Run the Database Migration

In your new Supabase project:
- Go to **SQL Editor**
- Open `supabase/migrations/001_initial_schema.sql`
- Paste the entire contents and click **Run**

This creates all tables and seeds:
- Bonthuys Family Trust
- tenbucks-mobile (Pty) Ltd
- Full chart of accounts for both entities
- The R345,000 land transfer as a Section 7C loan

## 3. Configure Environment Variables

Copy `.env.local.example` to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Find these in Supabase → Project Settings → API.

## 4. Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — redirects to the dashboard.

## 5. Update SARS Official Rate Quarterly

When SARS announces a new official rate (repo + 100bps), add a row in
Supabase → Table Editor → `official_rates`. The tracker recalculates
automatically.

## Phase 1 — What's Built

| Feature | Status |
|---|---|
| Dashboard with Section 7C exposure summary | ✅ |
| Entity cards (Bonthuys Family Trust, tenbucks-mobile) | ✅ |
| Full chart of accounts (per entity) | ✅ |
| Section 7C loan tracker with live interest calculation | ✅ |
| Add loan / record interest payment | ✅ |
| Donations tax risk indicator (28 Feb deadline) | ✅ |

## Phase 2 — Next (not yet built)

- Double-entry transaction ledger
- Bank statement import (CSV)
- Asset register (property, shares)

## Phase 3

- CGT calculator per asset
- Provisional tax estimate (IRP6)
- Income tax forecast (IT14 / IT12T)

## Phase 4

- SARS-ready report exports (PDF)
- Trust distribution schedule
- Tax optimisation advisor
