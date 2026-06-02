-- ============================================================
-- Tenbucks Accounting — Phase 3: Tax Engine
-- Run AFTER migrations 001 and 002
-- ============================================================

-- ── SA Tax Rate Tables (versioned by tax year) ────────────────

CREATE TABLE tax_rates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_year    INTEGER NOT NULL,          -- e.g., 2027 = 1 Mar 2026 – 28 Feb 2027
  entity_type TEXT NOT NULL CHECK (entity_type IN ('individual', 'company', 'trust')),
  flat_rate   DECIMAL(6,4),              -- company (0.27) / trust (0.45)
  brackets    JSONB,                     -- individual only: [{from,to,base_tax,rate}]
  primary_rebate    DECIMAL(10,2) DEFAULT 0,
  secondary_rebate  DECIMAL(10,2) DEFAULT 0,  -- age 65+
  tertiary_rebate   DECIMAL(10,2) DEFAULT 0,  -- age 75+
  tax_threshold     DECIMAL(10,2) DEFAULT 0,  -- below 65
  cgt_inclusion_rate  DECIMAL(5,4) NOT NULL,
  cgt_annual_exclusion DECIMAL(10,2) DEFAULT 0,
  donations_annual_exemption DECIMAL(10,2) DEFAULT 100000,
  donations_rate DECIMAL(5,4) DEFAULT 0.20,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tax_year, entity_type)
);

-- ── IRP6 Provisional Tax Submissions ─────────────────────────

CREATE TABLE provisional_tax (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id    UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tax_year     INTEGER NOT NULL,
  period       INTEGER NOT NULL CHECK (period IN (1, 2, 3)),
  due_date     DATE NOT NULL,
  estimated_taxable_income DECIMAL(15,2),
  estimated_tax  DECIMAL(15,2),
  amount_paid    DECIMAL(15,2) DEFAULT 0,
  payment_date   DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, tax_year, period)
);

-- ── Manual Tax Adjustments (add-backs / deductions) ──────────

CREATE TABLE income_adjustments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id   UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  tax_year    INTEGER NOT NULL,
  type        TEXT NOT NULL CHECK (type IN (
                'depreciation', 's13_allowance', 'prior_year_loss',
                'disallowable_expense', 'exempt_income', 'dividend_exempt',
                'fringe_benefit', 'other_deduction', 'other_income')),
  description TEXT NOT NULL,
  amount      DECIMAL(15,2) NOT NULL,  -- positive = reduces taxable income
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tax_rates         ENABLE ROW LEVEL SECURITY;
ALTER TABLE provisional_tax   ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_all" ON tax_rates          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON provisional_tax    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON income_adjustments FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- Seed: SA Tax Rates — 2025, 2026, 2027 (same brackets; verify
-- each February when SARS publishes the budget)
-- ============================================================

DO $$
BEGIN
  -- Insert for all three years with same rates
  FOR yr IN 2025..2027 LOOP

    -- Individual (Marius Bonthuys)
    INSERT INTO tax_rates (
      tax_year, entity_type,
      brackets,
      primary_rebate, secondary_rebate, tertiary_rebate, tax_threshold,
      cgt_inclusion_rate, cgt_annual_exclusion,
      donations_annual_exemption, donations_rate
    ) VALUES (
      yr, 'individual',
      '[
        {"from":        0, "to":   237100, "base_tax":      0, "rate": 0.18},
        {"from":   237101, "to":   370500, "base_tax":  42678, "rate": 0.26},
        {"from":   370501, "to":   512800, "base_tax":  77362, "rate": 0.31},
        {"from":   512801, "to":   673000, "base_tax": 121475, "rate": 0.36},
        {"from":   673001, "to":   857900, "base_tax": 179147, "rate": 0.39},
        {"from":   857901, "to":  1817000, "base_tax": 251258, "rate": 0.41},
        {"from":  1817001, "to": 999999999,"base_tax": 644489, "rate": 0.45}
      ]'::JSONB,
      17235, 9444, 3145, 95750,
      0.40, 40000,
      100000, 0.20
    ) ON CONFLICT (tax_year, entity_type) DO NOTHING;

    -- Company (tenbucks-mobile)
    INSERT INTO tax_rates (
      tax_year, entity_type, flat_rate,
      cgt_inclusion_rate, cgt_annual_exclusion
    ) VALUES (
      yr, 'company', 0.27,
      0.80, 0
    ) ON CONFLICT (tax_year, entity_type) DO NOTHING;

    -- Trust (Bonthuys Family Trust)
    INSERT INTO tax_rates (
      tax_year, entity_type, flat_rate,
      cgt_inclusion_rate, cgt_annual_exclusion,
      donations_annual_exemption, donations_rate
    ) VALUES (
      yr, 'trust', 0.45,
      0.80, 0,
      100000, 0.20
    ) ON CONFLICT (tax_year, entity_type) DO NOTHING;

  END LOOP;
END $$;

-- ============================================================
-- Seed: IRP6 provisional tax for tenbucks-mobile
-- Tax year 2027 (1 Mar 2026 – 28 Feb 2027) — both periods
-- ============================================================

INSERT INTO provisional_tax (entity_id, tax_year, period, due_date, notes)
SELECT
  id,
  2027,
  1,
  '2026-08-31',
  'P1 — first provisional payment. Due 31 Aug 2026. Estimate: 50% of projected annual CIT. Safe harbour: pay at least 50% of last year''s assessed tax to avoid penalty.'
FROM entities WHERE name = 'tenbucks-mobile (Pty) Ltd'
ON CONFLICT DO NOTHING;

INSERT INTO provisional_tax (entity_id, tax_year, period, due_date, notes)
SELECT
  id,
  2027,
  2,
  '2027-02-28',
  'P2 — second provisional payment. Due 28 Feb 2027 (year end). Ensure P1 + P2 ≥ 80% of actual annual tax to avoid 20% underpayment penalty.'
FROM entities WHERE name = 'tenbucks-mobile (Pty) Ltd'
ON CONFLICT DO NOTHING;

-- Also seed tax year 2026 (ended Feb 2026) for historical reference
INSERT INTO provisional_tax (entity_id, tax_year, period, due_date, notes)
SELECT id, 2026, 1, '2025-08-31', 'P1 — tax year 2026 (ended Feb 2026). Historical record.'
FROM entities WHERE name = 'tenbucks-mobile (Pty) Ltd' ON CONFLICT DO NOTHING;

INSERT INTO provisional_tax (entity_id, tax_year, period, due_date, notes)
SELECT id, 2026, 2, '2026-02-28', 'P2 — tax year 2026 (ended Feb 2026). Historical record.'
FROM entities WHERE name = 'tenbucks-mobile (Pty) Ltd' ON CONFLICT DO NOTHING;
