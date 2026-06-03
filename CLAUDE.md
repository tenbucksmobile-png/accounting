# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Tenbucks Accounting** — a private SA-compliant accounting web application for the Bonthuys family structure.

### The People
- **Maria J. Bonthuys** — founder of the trust, director and 100% owner of tenbucks-mobile (Pty) Ltd, personal owner of the vacant land and EasyEquities portfolio (pending transfer to trust)
- **Marius Bonthuys** — Maria's son, trustee (not the founder), earns R65k/month from personal employment, R10m life policy pending cession to trust
- **Dajahn Nume Bonthuys** — primary beneficiary (adult, Marius's son), no Section 7(3) attribution
- **Shone Riani Bonthuys** — primary beneficiary (minor, Marius's daughter), Section 7(3) applies while under 18 — distributions taxed at Marius's marginal rate

### The Entities
| Entity | Type | Owner | Status |
|---|---|---|---|
| Bonthuys Family Trust | trust | — | **Not yet registered** — pending Letters of Authority, Master of the High Court |
| tenbucks-mobile (Pty) Ltd | company | Maria J. Bonthuys | Active — to be transferred to trust post-registration |
| Maria J. Bonthuys (Personal) | personal | — | Pre-transfer asset tracking only |
| Bonthuys Developments (Pty) Ltd | company | Future: trust | **Not yet incorporated** — buy-renovate-sell division |

### The Strategy
The trust is the long-term holding structure. It does not accumulate cash — it acts as:
1. **A balance sheet** for capital assets (property, shares, company stakes) held indefinitely with no tax while held
2. **A conduit** for income — all rental income, management fees, dividends must be distributed to beneficiaries before 28 February each year to avoid the 45% trust flat rate

**Future property purchases (rental apartments) go directly into the trust** — never into tenbucks-mobile or Bonthuys Developments. The property trading/renovation business stays in Bonthuys Developments. These two must never mix (SARS mixed-intention test).

This is a **completely separate project from fizzog-mobile**. No shared code, no shared Supabase project.

---

## Commands

```bash
npm install
npm run dev           # localhost:3000
npm run build         # production build + type check (no separate lint/test step)
vercel --prod --yes   # deploy to production
```

There is no ESLint config and no test suite. `npm run build` is the only correctness gate.

Run migrations in **Supabase SQL Editor** (never via CLI — apply each file manually in order):
```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_phase2_ledger_assets.sql
supabase/migrations/003_phase3_tax_engine.sql
supabase/migrations/004_trust_phase5.sql
supabase/migrations/005_structure_correction.sql   ← run this to apply the corrected ownership structure
```

Run accounting SQL scripts in **Supabase SQL Editor** in this order:
```
Accounts/post-journal-entries-indaba-cares.sql
Accounts/post-bank-fees-and-opening-deposit.sql
Accounts/post-consulting-fee-and-monthly-close.sql
```

---

## Stack

- **Next.js 16.2.7** (App Router, TypeScript, Turbopack, React 19)
- **Supabase** — PostgreSQL + RLS via `@supabase/ssr`. Project ref: `wrzfgvxcnuyyzvwijqzb`
- **Shadcn UI v4** — uses `@base-ui/react` (NOT Radix). **`asChild` prop does not exist** on Button. Use styled `<Link>` instead: `<Link className="inline-flex items-center ... bg-primary ...">`
- **Tailwind CSS v4**
- **Vercel** — https://tenbucks-accounting.vercel.app

### Critical: Select `onValueChange` type

Shadcn v4 `Select.onValueChange` signature is `(value: string | null) => void`. Always write:
```tsx
onValueChange={(v: string | null) => setState(v ?? 'fallback')}
```

---

## Architecture

### Server vs. client component pattern

All dashboard `page.tsx` files are **async server components** that fetch data using `@/lib/supabase/server` (`createClient` from SSR package, uses cookies). They pass data down as props to client components.

Interactive mutations (buttons that open dialogs, forms that write to Supabase) live in separate `'use client'` files alongside the server page — e.g., `add-payment-button.tsx`, `add-loan-button.tsx`, `add-share-lot-button.tsx`. These call `@/lib/supabase/client` (browser client) directly — **there are no API routes**. All Supabase access goes either through the server client (SSR reads) or the browser client (client-component writes) using the anon key + RLS.

After a mutation, client components call `router.refresh()` to re-run the server component and show updated data.

### Type system

`src/types/database.ts` contains all hand-written TypeScript interfaces (`Entity`, `Account`, `JournalEntry`, `Asset`, etc.). The `Database` export at the bottom is a stub (`Record<string, never>`) — the typed Supabase client is **not** wired up. Server components therefore use `as any` when reading Supabase query results; this is intentional and expected.

### Authentication (Phase 6)

Password gate via `src/middleware.ts` — runs on every request, checks an HttpOnly signed cookie (`tenbucks-auth`). Login at `/login`, logout via `GET /api/auth/logout`. Two Vercel env vars required: `SITE_PASSWORD` and `COOKIE_SECRET`. Cookie is valid for 30 days. Changing either env var + redeploying invalidates all existing sessions.

### Accounts folder

`Accounts/` contains client-facing documents and Supabase SQL scripts — **not** application code. Files stored here:
- Invoices: `INV-YYYY-NNN-Client-Month.html` — open in Chrome → Print → Save as PDF to send
- Month-end close statements: `Month-End-Close-MMM-YYYY.html` — IFRS closing summaries with signature blocks
- SQL scripts: `post-*.sql` — run in Supabase SQL Editor to post journal entries

Invoice numbering convention: `INV-{year}-{sequence}` (e.g. `INV-2026-001`). Consulting fees: `CF-{year}-{sequence}`. Bank fees: `BF-{year}-{month}`. Closing entries: `CLOSE-{year}-{month}`.

### File layout

```
src/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx             — Sidebar + main layout shell
│   │   ├── page.tsx               — Dashboard: S7C exposure + entity summary
│   │   ├── entities/              — Entity list + [id] detail with chart of accounts
│   │   ├── accounts/              — Full chart of accounts (all entities)
│   │   ├── loans/                 — Section 7C loan tracker + annual exemption + write-down plan
│   │   ├── assets/                — Asset register (property, shares, CGT base cost) + [id] detail
│   │   ├── transactions/          — Double-entry journal ledger + new entry form
│   │   ├── import/                — Bank CSV import (FNB/ABSA/Nedbank/Standard Bank) — client component
│   │   ├── reports/               — Tax engine: IT14, IT12T, IRP6, CGT, what-if
│   │   └── trust/                 — Trust structure, beneficiary tax planner, distribution resolutions, life insurance
│   └── page.tsx                   — Redirects to /dashboard
├── components/
│   ├── nav-sidebar.tsx            — Sidebar navigation
│   └── ui/                        — Shadcn components
├── lib/
│   ├── supabase/client.ts         — Browser Supabase client (use in 'use client' components)
│   ├── supabase/server.ts         — Server Supabase client (async, uses cookies())
│   └── tax.ts                     — SA tax calculation utilities
└── types/
    └── database.ts                — All TypeScript interfaces
```

---

## Database Schema

Three migrations, all applied manually via Supabase SQL Editor.

### Core tables (001)
| Table | Purpose |
|---|---|
| `entities` | Trust + company records. Pre-seeded with both entities. |
| `accounts` | Chart of accounts per entity (double-entry, SA GAAP). Pre-seeded ~40 accounts per entity. |
| `official_rates` | SARS official interest rate (Section 7C). **Update quarterly** by inserting a new row. Currently 9.25%. |
| `section7c_loans` | Natural person loans to trust-connected entities. Pre-seeded: R345,000 land transfer. |
| `section7c_payments` | Interest payments per loan per tax year. |

### Ledger + assets (002)
| Table | Purpose |
|---|---|
| `journal_entries` | Double-entry journal header (entity, date, description, source). |
| `journal_lines` | Debit/credit lines per entry. CHECK: debit > 0 OR credit > 0, not both. |
| `assets` | Asset register: property, shares, cash. Pre-seeded: Vacant Land (R345k, tenbucks-mobile) + EasyEquities USD (R200k, trust). |
| `asset_property_details` | Property-specific: address, ERF, transfer duty, S13 building allowance rate. |
| `asset_improvements` | Capital improvements (add to CGT base cost). |
| `asset_share_lots` | Per-lot share tracking with ZAR cost base + foreign currency support. |

### Tax engine (003)
| Table | Purpose |
|---|---|
| `tax_rates` | SA tax brackets + CIT/trust flat rates by tax year (2025–2027 seeded). |
| `provisional_tax` | IRP6 P1/P2 records for tenbucks-mobile. P1 due 31 Aug 2026, P2 due 28 Feb 2027. |
| `income_adjustments` | Manual tax add-backs/deductions per entity per year. |

### Trust structure (004)
| Table | Purpose |
|---|---|
| `trust_trustees` | Trustee register. Pre-seeded: Marius Bonthuys (founder), Tanja Van Holdt (independent attorney), Maria Bonthuys. |
| `trust_beneficiaries` | Beneficiary register. Pre-seeded: Dajahn Bonthuys (major, DOB needs confirming) + Shone Bonthuys (minor, DOB needs confirming). Update DOBs from birth certificates. |
| `trust_life_policies` | Life insurance policies. `trust_owns_policy = true` = policy ceded to trust (outside estate); `false` = trust merely named beneficiary (inside estate for estate duty). |
| `trust_distribution_resolutions` | Formal trustee distribution resolutions per beneficiary per tax year. `income_character` tracks S25B character (interest/dividend/rental/capital_gain/other). |

---

## Key Business Rules (SA Tax)

- **SA tax year**: 1 March – 28 February. "Tax year 2027" = 1 Mar 2026 – 28 Feb 2027.
- **CIT**: 27% flat on company taxable income.
- **Trust**: 45% flat on undistributed income; distributions taxed at beneficiary marginal rate.
- **CGT inclusion**: 40% (individual), 80% (company + trust). Annual exclusion R40,000 individual only.
- **Section 7C**: Loans from natural persons to trust-connected entities must charge SARS official rate (currently 9.25%). Shortfall = deemed donation. First R100,000 of donations per year is exempt. See `loans/page.tsx` for the 5-year write-down plan logic.
- **Section 13 building allowance**: 2% p.a. residential, 5% commercial, 0% vacant land.
- **IRP6 safe harbour**: P1 + P2 must be ≥ 80% of actual annual tax to avoid 20% underpayment penalty.
- **DWT**: 20% on dividends declared by company.
- **Donations tax**: 20% on donations above R100,000 annual exemption.

---

## Tax Calculation Library (`src/lib/tax.ts`)

Key functions used across the reports page:
- `calcIndividualTax(income, brackets)` — raw tax before rebates
- `marginalRate(income, brackets)` — marginal rate for a given income
- `calcCGT(gain, rateRow, entityTaxRate)` — CGT after inclusion rate and annual exclusion
- `taxYearRange(year)` — returns `{ start: 'YYYY-03-01', end: 'YYYY-02-28' }`
- `currentTaxYear()` — returns current SA tax year number
- `fmtZAR(n)` — formats as South African Rand
- `annualise(amount, daysElapsed)` — projects YTD figure to full year

---

## Reports Page Architecture (`/dashboard/reports`)

Server component (`page.tsx`) fetches all data in a single `Promise.all` and passes props to three client components:
- `TaxYearSelector` — URL param `?year=2027` drives all calculations
- `IrpTracker` — IRP6 P1/P2 status, payment recording, 80% safe harbour
- `WhatIfSimulator` — interactive Fizzog revenue projection + retain vs salary comparison

**Hard-coded personal financials** in `reports/page.tsx`: `PERSONAL_SALARY = 65_000 * 12` and `RENTAL_NET = 2_200 * 12`. Update these constants directly in the file if the actual figures change.

The reports page performs a per-asset Supabase query for `asset_property_details` inside a render loop. Acceptable for the current small asset count; batch it if assets grow significantly.

---

## Section 7C Tracker Logic

The annual R100,000 donations tax exemption is tracked across all active loans combined:
1. All loans' projected interest shortfalls are summed
2. The sum is compared to R100,000
3. Remaining exemption = available for principal write-offs at zero tax
4. `buildWriteDownPlan()` in `loans/page.tsx` generates the N-year zero-tax elimination table

---

## Known Entities & Assets

After migration 005, the system reflects the **actual current ownership**:

| Entity | Type | Tax return | Owner / Status |
|---|---|---|---|
| Bonthuys Family Trust | trust | IT12T | Founder: Maria J. Bonthuys — not yet registered |
| tenbucks-mobile (Pty) Ltd | company | IT14 / IRP6 | Maria J. Bonthuys — pending trust transfer |
| Maria J. Bonthuys (Personal) | personal | IT12 | Pre-transfer asset tracking |
| Bonthuys Developments (Pty) Ltd | company | IT14 / IRP6 | Not yet incorporated |

| Asset | Current entity | Type | Cost base | Status |
|---|---|---|---|---|
| Vacant Land | Maria J. Bonthuys (Personal) | property | R345,000 | Maria's personal asset — pending trust transfer |
| EasyEquities USD Portfolio | Maria J. Bonthuys (Personal) | shares | R200,000 | Maria's personal asset — pending trust transfer |

EasyEquities share lot is a placeholder — replace with actual lots. Each needs: purchase date, quantity, USD price per unit, ZAR/USD rate on that date.

### Life Insurance
Marius Bonthuys holds a R10m life policy. Currently outside the trust (`trust_owns_policy = false`). **Required action**: cede to trust after registration — saves R2m in estate duty. Trust must then pay premiums from trust funds.

### Trustees (corrected)
| Name | Role |
|---|---|
| Maria J. Bonthuys | Founder & Trustee |
| Marius Bonthuys | Trustee (son of founder) |
| Tanja Van Holdt | Independent Trustee (Attorney) |

### Beneficiaries (corrected)
| Name | Status | Section 7(3) |
|---|---|---|
| Dajahn Nume Bonthuys | Adult (major) | Not applicable |
| Shone Riani Bonthuys | Minor | Applies — distributions taxed at Marius's marginal rate while under 18 |

---

## Deployment

- **Live URL**: https://tenbucks-accounting.vercel.app
- **GitHub**: https://github.com/tenbucksmobile-png/accounting
- **Vercel project**: tenbucksmobile-8550s-projects/tenbucks-accounting
- Env vars set in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SITE_PASSWORD`, `COOKIE_SECRET`
- Every `git push origin master` auto-deploys via Vercel GitHub integration
- GitHub repo is **public** (financial data lives in Supabase, not in the repo)

---

## Phase Roadmap

| Phase | Status | Contents |
|---|---|---|
| 1 | ✅ Done | Entities, Chart of Accounts, Section 7C loan tracker |
| 2 | ✅ Done | Journal ledger, asset register, bank CSV import |
| 3 | ✅ Done | Tax engine, IRP6 tracker, what-if simulator |
| 4 | Deferred | SARS-ready PDF report exports (IT14, IT12T, CGT schedule) — data is ready, needs PDF rendering layer |
| 5 | ✅ Done | Trust structure: trustee register, beneficiary tax planner, distribution resolutions (S25B), life insurance register (estate duty flags) |
| 6 | ✅ Done | Password protection — middleware cookie gate, `/login` page, `SITE_PASSWORD` + `COOKIE_SECRET` env vars |
