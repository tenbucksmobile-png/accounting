-- ============================================================
-- Tenbucks Accounting — Phase 1 Schema
-- Run this in your Supabase project SQL Editor
-- ============================================================

-- Entities (Trust, Company, Personal)
CREATE TABLE entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('trust', 'company', 'personal')),
  tax_number TEXT,
  registration_number TEXT,
  financial_year_end INTEGER DEFAULT 2 CHECK (financial_year_end BETWEEN 1 AND 12),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chart of Accounts (double-entry, per entity)
CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  category TEXT,
  description TEXT,
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')) DEFAULT 'debit',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(entity_id, code)
);

-- SARS Official Interest Rates (Section 7C)
CREATE TABLE official_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  effective_date DATE NOT NULL,
  rate DECIMAL(5,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Section 7C Loans (natural person → trust-connected company)
CREATE TABLE section7c_loans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lender_name TEXT NOT NULL,
  borrower_entity_id UUID NOT NULL REFERENCES entities(id),
  description TEXT NOT NULL,
  principal_amount DECIMAL(15,2) NOT NULL,
  loan_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Interest payments logged against each loan (per tax year)
CREATE TABLE section7c_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL REFERENCES section7c_loans(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  tax_year INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Seed: SARS official rate (update quarterly)
-- ============================================================
INSERT INTO official_rates (effective_date, rate, notes) VALUES
  ('2025-01-01', 9.25, 'Repo rate + 100bps. Update each quarter when SARS publishes.');

-- ============================================================
-- Seed: The two primary entities
-- ============================================================
INSERT INTO entities (name, type, financial_year_end, notes) VALUES
  ('Bonthuys Family Trust', 'trust', 2, 'Inter vivos discretionary trust. IT12T filer. Owns 100% of tenbucks-mobile (Pty) Ltd.'),
  ('tenbucks-mobile (Pty) Ltd', 'company', 2, 'Operating company. Owns Fizzog. Holds property assets. IT14 / IRP6 filer.');

-- ============================================================
-- Seed: Chart of Accounts — tenbucks-mobile (Pty) Ltd
-- ============================================================
DO $$
DECLARE
  co_id UUID;
  tr_id UUID;
BEGIN
  SELECT id INTO co_id FROM entities WHERE name = 'tenbucks-mobile (Pty) Ltd';
  SELECT id INTO tr_id FROM entities WHERE name = 'Bonthuys Family Trust';

  -- ── ASSETS ──────────────────────────────────────────────
  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance) VALUES
    (co_id, '1000', 'Bank — Current Account',        'asset', 'Cash',             'debit'),
    (co_id, '1010', 'Bank — Savings Account',         'asset', 'Cash',             'debit'),
    (co_id, '1100', 'Accounts Receivable',            'asset', 'Receivables',      'debit'),
    (co_id, '1200', 'Loan: Marius Bonthuys (S7C)',   'asset', 'Loan Accounts',    'credit'),
    (co_id, '1300', 'Investment — Shares Portfolio',  'asset', 'Investments',      'debit'),
    (co_id, '1400', 'Fixed Property — Vacant Land',  'asset', 'Fixed Assets',     'debit'),
    (co_id, '1410', 'Fixed Property — Apartment',    'asset', 'Fixed Assets',     'debit'),
    (co_id, '1500', 'Accumulated Depreciation',       'asset', 'Fixed Assets',     'credit'),
    (co_id, '1600', 'Provisional Tax Paid (IRP6)',    'asset', 'Tax Assets',       'debit');

  -- ── LIABILITIES ─────────────────────────────────────────
  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance) VALUES
    (co_id, '2000', 'Accounts Payable',               'liability', 'Payables',       'credit'),
    (co_id, '2100', 'Loan: Marius Bonthuys',          'liability', 'Shareholder Loans', 'credit'),
    (co_id, '2200', 'Mortgage Bond — Apartment',      'liability', 'Debt',           'credit'),
    (co_id, '2300', 'Income Tax Payable',              'liability', 'Tax Liabilities','credit'),
    (co_id, '2310', 'Deferred Tax',                   'liability', 'Tax Liabilities','credit'),
    (co_id, '2400', 'VAT Payable',                    'liability', 'Tax Liabilities','credit');

  -- ── EQUITY ──────────────────────────────────────────────
  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance) VALUES
    (co_id, '3000', 'Share Capital',                  'equity', 'Capital',          'credit'),
    (co_id, '3100', 'Retained Earnings',              'equity', 'Retained Earnings','credit'),
    (co_id, '3200', 'Current Year Earnings',          'equity', 'Retained Earnings','credit');

  -- ── INCOME ──────────────────────────────────────────────
  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance) VALUES
    (co_id, '4000', 'Fizzog — App Revenue',           'income', 'Operating Income', 'credit'),
    (co_id, '4100', 'License Fee — Indaba Cares',     'income', 'Operating Income', 'credit'),
    (co_id, '4200', 'Rental Income — Apartment',      'income', 'Property Income',  'credit'),
    (co_id, '4300', 'Dividend Income (SA)',            'income', 'Investment Income','credit'),
    (co_id, '4400', 'Dividend Income (Foreign)',       'income', 'Investment Income','credit'),
    (co_id, '4500', 'Interest Received',               'income', 'Investment Income','credit'),
    (co_id, '4600', 'Capital Gain on Disposal',       'income', 'Capital',          'credit');

  -- ── EXPENSES ────────────────────────────────────────────
  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance) VALUES
    (co_id, '5000', 'Bank Charges',                   'expense', 'Admin',            'debit'),
    (co_id, '5100', 'Accounting & Audit Fees',        'expense', 'Professional',     'debit'),
    (co_id, '5110', 'Legal Fees',                     'expense', 'Professional',     'debit'),
    (co_id, '5200', 'Insurance',                      'expense', 'Property',         'debit'),
    (co_id, '5300', 'Rates & Taxes — Apartment',      'expense', 'Property',         'debit'),
    (co_id, '5400', 'Repairs & Maintenance',          'expense', 'Property',         'debit'),
    (co_id, '5500', 'Interest Expense — Bond',        'expense', 'Finance',          'debit'),
    (co_id, '5510', 'Interest Expense — S7C Loan',   'expense', 'Finance',          'debit'),
    (co_id, '5600', 'Depreciation',                   'expense', 'Non-cash',         'debit'),
    (co_id, '5700', 'Section 13 Building Allowance', 'expense', 'Non-cash',         'debit'),
    (co_id, '5800', 'Management Fees Paid',           'expense', 'Admin',            'debit'),
    (co_id, '5900', 'Income Tax Expense (CIT 27%)',  'expense', 'Tax',              'debit');

  -- ── TRUST: ASSETS ────────────────────────────────────────
  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance) VALUES
    (tr_id, '1000', 'Bank — Trust Account',           'asset', 'Cash',              'debit'),
    (tr_id, '1100', 'Investment — Foreign Shares',    'asset', 'Investments',       'debit'),
    (tr_id, '1200', 'Loan to Beneficiary — Marius',  'asset', 'Loan Accounts',     'debit'),
    (tr_id, '1300', 'Shares in tenbucks-mobile',      'asset', 'Investments',       'debit');

  -- ── TRUST: LIABILITIES ───────────────────────────────────
  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance) VALUES
    (tr_id, '2000', 'Loan from Founder — Marius',    'liability', 'Founder Loans',  'credit'),
    (tr_id, '2100', 'Income Tax Payable (IT12T)',     'liability', 'Tax Liabilities','credit');

  -- ── TRUST: EQUITY ────────────────────────────────────────
  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance) VALUES
    (tr_id, '3000', 'Trust Capital',                  'equity', 'Capital',           'credit'),
    (tr_id, '3100', 'Accumulated Surplus',            'equity', 'Retained Earnings', 'credit');

  -- ── TRUST: INCOME ────────────────────────────────────────
  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance) VALUES
    (tr_id, '4000', 'Dividends Received from Company','income','Investment Income',  'credit'),
    (tr_id, '4100', 'Management Fees Received',       'income', 'Operating Income',  'credit'),
    (tr_id, '4200', 'Interest Received',              'income', 'Investment Income',  'credit'),
    (tr_id, '4300', 'Foreign Dividend Income',        'income', 'Investment Income',  'credit'),
    (tr_id, '4400', 'Capital Gain — Foreign Shares',  'income', 'Capital',           'credit');

  -- ── TRUST: EXPENSES ──────────────────────────────────────
  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance) VALUES
    (tr_id, '5000', 'Trustee Fees',                  'expense', 'Admin',             'debit'),
    (tr_id, '5100', 'Accounting Fees',               'expense', 'Professional',      'debit'),
    (tr_id, '5200', 'S7C Interest Paid to Founder',  'expense', 'Finance',           'debit'),
    (tr_id, '5300', 'Trust Distributions',           'expense', 'Distributions',     'debit'),
    (tr_id, '5400', 'Income Tax Expense (IT12T)',    'expense', 'Tax',               'debit');

END $$;

-- ============================================================
-- Seed: Section 7C Loans — Land transfer (Marius → tenbucks-mobile)
-- ============================================================
INSERT INTO section7c_loans (
  lender_name, borrower_entity_id, description,
  principal_amount, loan_date, notes
)
SELECT
  'Marius Bonthuys',
  id,
  'Vacant land transferred to company — loan account (no transfer duty, no CGT)',
  345000.00,
  CURRENT_DATE,
  'Land valued at R345,000. Zero CGT event (base cost = market value). Loan account created in favour of Marius Bonthuys. Section 7C applies: charge official interest rate (9.25% p.a.) annually by 28 Feb each tax year.'
FROM entities WHERE name = 'tenbucks-mobile (Pty) Ltd';

-- ============================================================
-- RLS — enable for all tables (Supabase requires this)
-- Add your own policy once auth is configured
-- ============================================================
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE official_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE section7c_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE section7c_payments ENABLE ROW LEVEL SECURITY;

-- Temporary open policy during development — REPLACE with auth-based policy before production
CREATE POLICY "dev_all" ON entities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON official_rates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON section7c_loans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_all" ON section7c_payments FOR ALL USING (true) WITH CHECK (true);
