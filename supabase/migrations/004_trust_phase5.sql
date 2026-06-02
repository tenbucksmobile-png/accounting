-- Phase 5: Trust beneficiary management, distribution resolutions, life insurance register

CREATE TABLE trust_trustees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  is_independent boolean DEFAULT false,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE trust_beneficiaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date_of_birth date NOT NULL,
  sa_resident boolean DEFAULT true,
  annual_other_income numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE trust_life_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_number text,
  insurer text NOT NULL,
  insured_person text NOT NULL,
  sum_assured_zar numeric NOT NULL,
  annual_premium_zar numeric,
  trust_owns_policy boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE trust_distribution_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiary_id uuid NOT NULL REFERENCES trust_beneficiaries(id) ON DELETE RESTRICT,
  tax_year integer NOT NULL,
  resolution_date date NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  income_character text NOT NULL DEFAULT 'other'
    CHECK (income_character IN ('interest', 'dividend', 'rental', 'capital_gain', 'other')),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Seed trustees
INSERT INTO trust_trustees (name, role, is_independent) VALUES
  ('Marius Bonthuys', 'Founder & Trustee', false),
  ('Tanja Van Holdt', 'Independent Trustee (Attorney)', true),
  ('Maria Bonthuys', 'Trustee', false);

-- Seed beneficiaries
-- Update exact DOBs from birth certificates before first use
INSERT INTO trust_beneficiaries (name, date_of_birth, sa_resident, annual_other_income, notes) VALUES
  ('Dajahn Bonthuys', '2006-01-01', true, 0, 'Major beneficiary — update exact DOB from birth certificate'),
  ('Shone Bonthuys',  '2011-01-01', true, 0, 'Minor beneficiary — Section 7(3) attribution to Marius applies while under 18. Update exact DOB from birth certificate.');
