-- ============================================================
-- Tenbucks Accounting — Phase 2: Ledger + Asset Register
-- Run this in Supabase SQL Editor AFTER migration 001
-- ============================================================

-- ── Double-entry Journal Entries ────────────────────────────

CREATE TABLE journal_entries (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id    UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  entry_date   DATE NOT NULL,
  description  TEXT NOT NULL,
  reference    TEXT,           -- bank ref, invoice number, EFT ref
  source       TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'import')),
  is_reconciled BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Each entry has 2+ lines; debits must equal credits
CREATE TABLE journal_lines (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id    UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id  UUID NOT NULL REFERENCES accounts(id),
  debit       DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit      DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  CHECK (debit > 0 OR credit > 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX idx_journal_entries_entity ON journal_entries(entity_id, entry_date DESC);
CREATE INDEX idx_journal_lines_account  ON journal_lines(account_id);
CREATE INDEX idx_journal_lines_entry    ON journal_lines(entry_id);

-- ── Asset Register ───────────────────────────────────────────

CREATE TABLE assets (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id        UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('property', 'shares', 'cash', 'other')),
  description      TEXT,
  acquisition_date DATE NOT NULL,
  cost_base_zar    DECIMAL(15,2) NOT NULL,    -- purchase price + acquisition costs in ZAR
  current_value_zar DECIMAL(15,2),            -- manual valuation (updated periodically)
  current_value_date DATE,
  is_disposed      BOOLEAN DEFAULT false,
  disposal_date    DATE,
  disposal_proceeds_zar DECIMAL(15,2),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Property-specific detail
CREATE TABLE asset_property_details (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id            UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE UNIQUE,
  address             TEXT,
  erf_number          TEXT,
  property_type       TEXT CHECK (property_type IN ('residential', 'commercial', 'vacant_land')),
  transfer_duty_paid  DECIMAL(15,2) DEFAULT 0,
  conveyancing_fees   DECIMAL(15,2) DEFAULT 0,
  -- Section 13 building allowance
  building_cost_zar   DECIMAL(15,2) DEFAULT 0,   -- cost of structure (not land)
  s13_rate            DECIMAL(5,2)  DEFAULT 2.0,  -- % p.a.: 2% residential, 5% commercial
  s13_start_date      DATE,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Capital improvements (added to CGT base cost)
CREATE TABLE asset_improvements (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id    UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount_zar  DECIMAL(15,2) NOT NULL,
  date        DATE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Share lots (per-lot CGT tracking; supports foreign currency)
CREATE TABLE asset_share_lots (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id              UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  purchase_date         DATE NOT NULL,
  quantity              DECIMAL(15,6) NOT NULL,
  cost_per_unit_zar     DECIMAL(15,6) NOT NULL,   -- ZAR cost base per unit
  currency              TEXT NOT NULL DEFAULT 'ZAR',
  cost_per_unit_foreign DECIMAL(15,6),             -- original currency price
  exchange_rate_at_buy  DECIMAL(10,6) DEFAULT 1,   -- ZAR per 1 unit of foreign currency
  broker_fees_zar       DECIMAL(15,2) DEFAULT 0,
  notes                 TEXT,
  -- disposal
  is_fully_disposed     BOOLEAN DEFAULT false,
  disposed_quantity     DECIMAL(15,6) DEFAULT 0,
  disposal_date         DATE,
  disposal_proceeds_zar DECIMAL(15,2),
  created_at            TIMESTAMPTZ DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE journal_entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_property_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_improvements ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_share_lots   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_all" ON journal_entries        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON journal_lines          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON assets                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON asset_property_details FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON asset_improvements     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON asset_share_lots       FOR ALL USING (true) WITH CHECK (true);

-- ── Seed: Known Assets ───────────────────────────────────────

DO $$
DECLARE
  co_id UUID;
  tr_id UUID;
  land_id UUID;
  shares_id UUID;
BEGIN
  SELECT id INTO co_id FROM entities WHERE name = 'tenbucks-mobile (Pty) Ltd';
  SELECT id INTO tr_id FROM entities WHERE name = 'Bonthuys Family Trust';

  -- Vacant land (now in company after transfer — zero CGT event)
  INSERT INTO assets (
    entity_id, name, type, description,
    acquisition_date, cost_base_zar, notes
  ) VALUES (
    co_id,
    'Vacant Land',
    'property',
    'Freehold vacant stand. Transferred to tenbucks-mobile at R345,000 via loan account. Zero CGT on transfer (base cost = market value).',
    CURRENT_DATE,
    345000.00,
    'Original purchase price R345,000 — 20 year bond now paid off. No improvements. S7C loan account of R345,000 created in favour of Marius Bonthuys.'
  ) RETURNING id INTO land_id;

  INSERT INTO asset_property_details (
    asset_id, property_type, transfer_duty_paid,
    conveyancing_fees, building_cost_zar, s13_rate
  ) VALUES (
    land_id, 'vacant_land', 0, 0, 0, 0
  );

  -- Foreign share portfolio (EasyEquities USD — held in trust directly)
  INSERT INTO assets (
    entity_id, name, type, description,
    acquisition_date, cost_base_zar, current_value_zar, current_value_date, notes
  ) VALUES (
    tr_id,
    'EasyEquities USD Portfolio',
    'shares',
    'USD-denominated shares held on EasyEquities platform. Foreign shares — dividends fully taxable (not exempt). CGT calculated in ZAR using exchange rate at purchase/disposal.',
    CURRENT_DATE,
    200000.00,
    200000.00,
    CURRENT_DATE,
    'Optimal home: trust directly (not company) — distributions to lower-bracket beneficiaries achieve better CGT rate than company (21.6%). Update current_value_zar quarterly using current ZAR/USD rate × portfolio USD value.'
  ) RETURNING id INTO shares_id;

  -- Add a placeholder share lot — update with actual lots from EasyEquities history
  INSERT INTO asset_share_lots (
    asset_id, purchase_date, quantity, cost_per_unit_zar,
    currency, cost_per_unit_foreign, exchange_rate_at_buy,
    broker_fees_zar, notes
  ) VALUES (
    shares_id,
    CURRENT_DATE,
    1,
    200000.00,
    'USD',
    NULL,
    1,
    0,
    'PLACEHOLDER — replace with actual lots from EasyEquities transaction history. Each lot needs: purchase date, quantity, USD price per unit, ZAR/USD exchange rate on that date.'
  );

END $$;
