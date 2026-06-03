-- ============================================================
-- Tenbucks Accounting — Migration 005: Structure Correction
-- Run in Supabase SQL Editor AFTER migrations 001–004
--
-- Corrects the structure to reflect the actual ownership:
--   • Maria J. Bonthuys is the owner/director of tenbucks-mobile
--     and the founder of the trust (not Marius)
--   • Marius Bonthuys is Maria's son, a trustee, earns R65k/month
--   • The vacant land and EasyEquities portfolio are Maria's
--     personal assets — not yet transferred anywhere
--   • Adds Maria personal entity + Bonthuys Developments (Pty) Ltd
--   • Adds trust accounts for the planned property portfolio
-- ============================================================

DO $$
DECLARE
  trust_id          uuid;
  co_id             uuid;
  maria_id          uuid;
  dev_id            uuid;
  land_asset_id     uuid;
  shares_asset_id   uuid;
BEGIN

  SELECT id INTO trust_id FROM entities WHERE name = 'Bonthuys Family Trust';
  SELECT id INTO co_id    FROM entities WHERE name = 'tenbucks-mobile (Pty) Ltd';

  IF trust_id IS NULL THEN RAISE EXCEPTION 'Trust entity not found — run migrations 001–004 first'; END IF;
  IF co_id    IS NULL THEN RAISE EXCEPTION 'Company entity not found — run migrations 001–004 first'; END IF;

  -- ── 1. ENTITY NOTES ────────────────────────────────────────────────────────

  UPDATE entities SET notes =
    'Operating company. Director & 100% owner: Maria J. Bonthuys. '
    'To be transferred to Bonthuys Family Trust post-registration. '
    'Apps & tech division only (Fizzog, Indaba Cares licensing, consulting). '
    'Does NOT hold property — property acquired by the trust directly. '
    'Pays management fee to trust. IT14 / IRP6 filer.'
  WHERE id = co_id;

  UPDATE entities SET notes =
    'Inter vivos discretionary trust. Founder: Maria J. Bonthuys. IT12T filer. '
    'Will own tenbucks-mobile shares + rental apartments directly. '
    'Trust not yet registered — pending Letters of Authority from Master of the High Court. '
    'Acts as conduit: income distributed to beneficiaries before 28 Feb each year. '
    'Holds capital assets on balance sheet permanently (no estate duty on death).'
  WHERE id = trust_id;

  RAISE NOTICE '✓ Entity notes updated';

  -- ── 2. TRUSTEE ROLES ───────────────────────────────────────────────────────

  UPDATE trust_trustees SET role = 'Founder & Trustee'
  WHERE name = 'Maria Bonthuys';

  UPDATE trust_trustees SET role = 'Trustee (Son of Founder)'
  WHERE name = 'Marius Bonthuys';

  RAISE NOTICE '✓ Trustee roles corrected';

  -- ── 3. BENEFICIARY FULL NAMES ──────────────────────────────────────────────

  UPDATE trust_beneficiaries
  SET name  = 'Dajahn Nume Bonthuys',
      notes = 'Major beneficiary — son of Marius Bonthuys, grandson of Maria (Founder). '
              'Approx age 19–20 as at 2026. No Section 7(3) attribution applies (adult). '
              'Prioritise distributions to Dajahn while Shone is still a minor. '
              'Update exact DOB from birth certificate.'
  WHERE name ILIKE 'Dajahn%';

  UPDATE trust_beneficiaries
  SET name  = 'Shone Riani Bonthuys',
      notes = 'Minor beneficiary — daughter of Marius Bonthuys, granddaughter of Maria (Founder). '
              'Section 7(3) of the Income Tax Act attributes distributions to Marius (her parent) '
              'while she is under 18 — taxed at Marius''s marginal rate. '
              'Minimise distributions to Shone until she reaches majority. '
              'Update exact DOB from birth certificate.'
  WHERE name ILIKE 'Shone%';

  RAISE NOTICE '✓ Beneficiary full names corrected';

  -- ── 4. DEACTIVATE ERRONEOUS S7C LOAN ──────────────────────────────────────
  -- The vacant land has NOT been transferred. No R345k loan exists.
  -- Re-activate when an actual S7C-applicable loan is made.

  UPDATE section7c_loans
  SET is_active = false,
      notes     = 'INACTIVE — Vacant land has NOT been transferred to the company. '
                  'This seeded entry was based on a hypothetical structure that was reconsidered. '
                  'The land remains Maria J. Bonthuys personal property pending trust registration. '
                  'Re-activate and update when an actual interest-bearing loan is advanced '
                  'by a natural person to a connected entity (S7C will apply).'
  WHERE lender_name = 'Marius Bonthuys';

  RAISE NOTICE '✓ Erroneous S7C loan deactivated';

  -- ── 5. FIX ACCOUNT NAMES — tenbucks-mobile ─────────────────────────────────

  -- Account 1200: was "Loan: Marius Bonthuys (S7C)" — Marius is not the shareholder
  UPDATE accounts
  SET name        = 'Director Loan Account — Maria J. Bonthuys',
      description = 'Loan advanced by Maria J. Bonthuys (director/sole shareholder) to the company. '
                    'Once the trust owns the company, re-evaluate S7C applicability.'
  WHERE entity_id = co_id AND code = '1200';

  -- Account 2100: was "Loan: Marius Bonthuys" — correct to Maria
  UPDATE accounts
  SET name        = 'Shareholder Loan — Maria J. Bonthuys',
      description = 'Shareholder loan from Maria J. Bonthuys. Interest at official SARS rate once S7C applies (post trust registration and share transfer).'
  WHERE entity_id = co_id AND code = '2100';

  -- Account 5800: was Management Fees Paid — clarify this is to the trust
  UPDATE accounts
  SET name        = 'Management Fee — Bonthuys Family Trust',
      description = 'Monthly management/administrative fee paid to Bonthuys Family Trust for oversight services. Deductible at 27% CIT. Trust receives income without DWT. Must be supported by service agreement and monthly invoices.'
  WHERE entity_id = co_id AND code = '5800';

  -- ── 6. FIX ACCOUNT NAMES — Trust ───────────────────────────────────────────

  -- Account 2000: was "Loan from Founder — Marius" — Maria is the founder
  UPDATE accounts
  SET name        = 'Loan from Founder — Maria J. Bonthuys',
      description = 'Loan or capital contribution from Maria J. Bonthuys (founder). '
                    'If structured as a loan: interest at official SARS rate applies (S7C). '
                    'Annual donations of R100k credited to Trust Capital (account 3000) instead.'
  WHERE entity_id = trust_id AND code = '2000';

  -- Account 1200: was "Loan to Beneficiary — Marius" — Marius is a trustee, not beneficiary
  UPDATE accounts
  SET name        = 'Beneficiary Loan Accounts',
      description = 'Amounts accrued to beneficiaries (Dajahn / Shone) not yet paid in cash. '
                    'Represents formally resolved distributions held in trust on their behalf.'
  WHERE entity_id = trust_id AND code = '1200';

  -- Account 5200: was "S7C Interest Paid to Founder" — founder is Maria, not Marius
  UPDATE accounts
  SET name        = 'S7C Interest Paid to Founder (Maria J. Bonthuys)',
      description = 'Interest paid on loan from Maria J. Bonthuys at official SARS rate (S7C compliant). Deductible in trust if loan funds income-producing activities.'
  WHERE entity_id = trust_id AND code = '5200';

  RAISE NOTICE '✓ Account names corrected';

  -- ── 7. ADD TRUST ACCOUNTS for rental property portfolio ────────────────────

  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance, description) VALUES
    (trust_id, '1400', 'Investment Property — Apartment Portfolio', 'asset', 'Investment Property', 'debit',
     'Buy-and-hold residential apartments held directly in the trust. Cost basis per apartment tracked here. IFRS: IAS 40 cost model (cost less accumulated depreciation). DO NOT mix with Bonthuys Developments (Pty) Ltd trading stock.'),
    (trust_id, '1500', 'Accumulated Depreciation — Investment Property', 'asset', 'Investment Property', 'credit',
     'Accumulated depreciation on investment property buildings (excluding land component). S13: 2% p.a. residential.'),
    (trust_id, '1310', 'Capital Contribution — Maria J. Bonthuys', 'asset', 'Capital Contributions', 'debit',
     'Cumulative donations from Maria (R100k/year within donations tax exemption). Increases trust capital. NOT a loan — no S7C applies to donations.'),
    (trust_id, '1320', 'Capital Contribution — Marius Bonthuys', 'asset', 'Capital Contributions', 'debit',
     'Cumulative donations from Marius (R100k/year within donations tax exemption). Increases trust capital. NOT a loan — no S7C applies to donations.'),
    (trust_id, '2200', 'Mortgage Bond — Investment Properties', 'liability', 'Debt', 'credit',
     'Home loan bonds secured against trust-held apartments. Maria J. Bonthuys and Marius Bonthuys stand as personal sureties. Bond repayments split: interest = expense (deductible), capital = balance sheet reduction.'),
    (trust_id, '4500', 'Rental Income — Investment Properties', 'income', 'Property Income', 'credit',
     'Gross rental received from tenants. Must be distributed to beneficiaries before 28 Feb to avoid 45% trust flat rate. Net of bond interest, rates, levies, maintenance = distributable amount.'),
    (trust_id, '4600', 'Management Fee Income — tenbucks-mobile', 'income', 'Operating Income', 'credit',
     'Monthly management/admin fee received from tenbucks-mobile (Pty) Ltd. No DWT applies (not a dividend). Deductible in the company at 27% CIT. Must be distributed to beneficiaries before 28 Feb.'),
    (trust_id, '5500', 'Bond Interest — Investment Properties', 'expense', 'Finance', 'debit',
     'Interest portion of bond repayments on trust apartments. Deductible against rental income (IAS 17 / SARS). Capital repayment portion is NOT an expense — reduces bond liability on balance sheet.'),
    (trust_id, '5600', 'Rates & Levies — Investment Properties', 'expense', 'Property', 'debit',
     'Municipal rates and body corporate levies on trust-held apartments. Deductible against rental income.'),
    (trust_id, '5700', 'Maintenance & Repairs — Investment Properties', 'expense', 'Property', 'debit',
     'Repairs and maintenance costs on trust apartments. Deductible against rental income. Capital improvements (adding to CGT base cost) go to asset_improvements table, not here.'),
    (trust_id, '5800', 'S13 Building Allowance — Investment Property', 'expense', 'Non-cash', 'debit',
     'Section 13(1) building allowance: 2% p.a. on residential building cost (not land). Non-cash deduction against rental income.');

  RAISE NOTICE '✓ Trust property accounts added';

  -- ── 8. ADD MARIA J. BONTHUYS — PERSONAL ENTITY ────────────────────────────

  INSERT INTO entities (name, type, financial_year_end, notes)
  VALUES (
    'Maria J. Bonthuys (Personal)', 'personal', 2,
    'Maria Jacoba Bonthuys — personal estate tracking. '
    'Currently owns: tenbucks-mobile (Pty) Ltd (100%), vacant land, EasyEquities USD portfolio. '
    'Founder of Bonthuys Family Trust (not yet registered). '
    'Plan: transfer company shares + assets to trust post-registration. '
    'IT12 personal income tax filer. R100,000/year donations tax exemption available.'
  )
  RETURNING id INTO maria_id;

  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance, description) VALUES
    (maria_id, '1000', 'Personal Bank Account', 'asset', 'Cash', 'debit',
     'Maria''s personal current/savings account.'),
    (maria_id, '1100', 'Vacant Land — Pending Trust Transfer', 'asset', 'Fixed Assets - Personal', 'debit',
     'Freehold vacant stand. Maria''s personal property — NOT yet transferred. '
     'Cost: R345,000. No bond. Pending: donation or loan sale to Bonthuys Family Trust post-registration. '
     'CGT base cost = R345,000. Annual exclusion R40,000 available while in personal name.'),
    (maria_id, '1200', 'EasyEquities USD Portfolio — Pending Trust Transfer', 'asset', 'Investments - Personal', 'debit',
     'USD-denominated shares held on EasyEquities. Maria''s personal investment — NOT yet in trust. '
     'Placeholder cost R200,000. Pending transfer to trust (donate within R100k annual exemption or phased). '
     'Update value quarterly: current USD portfolio value × ZAR/USD exchange rate.'),
    (maria_id, '1300', 'tenbucks-mobile Shares — Pending Trust Transfer', 'asset', 'Investments - Personal', 'debit',
     '100% shareholding in tenbucks-mobile (Pty) Ltd. Maria''s personal asset. '
     'Pending: transfer to Bonthuys Family Trust. Transfer NOW while company equity is minimal '
     '(only R25,768 retained earnings as at May 2026) to minimise CGT on the disposal.'),
    (maria_id, '3000', 'Personal Net Worth / Capital', 'equity', 'Capital', 'credit',
     'Maria''s net personal estate value (assets less liabilities).'),
    (maria_id, '4000', 'Dividends from tenbucks-mobile', 'income', 'Investment Income', 'credit',
     'Dividends declared by tenbucks-mobile (Pty) Ltd to Maria. Net of 20% DWT already withheld at company level. Exempt from income tax in her personal hands.'),
    (maria_id, '5000', 'Annual Donation — Bonthuys Family Trust', 'expense', 'Donations', 'debit',
     'R100,000 annual donation to the trust. Within donations tax exemption — no tax. '
     'Increases trust capital. Record each year before 28 February.');

  RAISE NOTICE '✓ Maria J. Bonthuys (Personal) entity created';

  -- ── 9. ADD BONTHUYS DEVELOPMENTS (PTY) LTD ────────────────────────────────

  INSERT INTO entities (name, type, financial_year_end, notes)
  VALUES (
    'Bonthuys Developments (Pty) Ltd', 'company', 2,
    'Property trading & renovation company — buy, renovate, sell division. '
    'CRITICAL: All property held here is TRADING STOCK (not capital assets). '
    'Profits taxed as income at CIT 27%. '
    'MUST remain completely separate from the trust''s buy-and-hold rental portfolio. '
    'Mixing trading and investment property in one entity risks SARS reclassifying all '
    'properties as trading stock. To be owned by Bonthuys Family Trust. '
    'IT14 / IRP6 filer.'
  )
  RETURNING id INTO dev_id;

  INSERT INTO accounts (entity_id, code, name, type, category, normal_balance, description) VALUES
    -- Assets
    (dev_id, '1000', 'Bank — Developments Account',   'asset', 'Cash',         'debit',  'Operating bank account for property development activities.'),
    (dev_id, '1100', 'Properties — Trading Stock',     'asset', 'Inventory',    'debit',
     'Properties acquired for renovation and resale. INVENTORY — not fixed assets. '
     'Recorded at lower of cost or net realisable value (IFRS IAS 2). '
     'Cost includes: purchase price + transfer duty + conveyancing + renovation costs. '
     'Transferred to Cost of Sales on disposal.'),
    (dev_id, '1200', 'Accounts Receivable',            'asset', 'Receivables',  'debit',  'Amounts owed by property buyers (bridging period).'),
    -- Liabilities
    (dev_id, '2000', 'Accounts Payable',               'liability', 'Payables',       'credit', 'Amounts owed to contractors and suppliers.'),
    (dev_id, '2100', 'Bridging Finance / Bond',         'liability', 'Debt',           'credit', 'Short-term bridging finance or purchase bonds on trading properties. Repaid on sale.'),
    (dev_id, '2200', 'Income Tax Payable (CIT)',        'liability', 'Tax Liabilities','credit', 'CIT 27% payable on taxable trading profit.'),
    -- Equity
    (dev_id, '3000', 'Share Capital',                  'equity', 'Capital',          'credit', 'Issued share capital.'),
    (dev_id, '3100', 'Retained Earnings',              'equity', 'Retained Earnings','credit', 'Accumulated after-tax profits retained in the company.'),
    -- Income
    (dev_id, '4000', 'Revenue — Property Sales',       'income', 'Trading Revenue',  'credit',
     'Sale proceeds on disposal of renovated properties. Full amount = revenue (IAS 2). Cost of sale posted to account 5000.'),
    -- Cost of Sales (expense type)
    (dev_id, '5000', 'Cost of Properties Sold',        'expense', 'Cost of Sales',   'debit',
     'Book value of trading stock transferred to P&L on disposal. Includes original purchase price, transfer duty, conveyancing, all renovation costs accumulated in account 1100.'),
    (dev_id, '5100', 'Renovation & Improvement Costs', 'expense', 'Cost of Sales',   'debit',
     'Labour, materials, and contractor costs during the renovation phase. '
     'During renovation: Dr this account / Cr Bank. On sale: these flow through via account 5000. '
     'Note: while property is held, capitalise to account 1100 (Trading Stock); expense through 5000 only on sale.'),
    (dev_id, '5200', 'Transfer Duty & Conveyancing',   'expense', 'Cost of Sales',   'debit',  'Transfer duty and legal costs on acquisition — capitalised to trading stock cost.'),
    -- Operating expenses
    (dev_id, '5300', 'Estate Agent Commissions',       'expense', 'Selling Costs',   'debit',  'Agent commissions on sale (typically 5–7.5% + VAT).'),
    (dev_id, '5400', 'Marketing & Advertising',        'expense', 'Selling Costs',   'debit',  'Listing fees, photography, online advertising.'),
    (dev_id, '5500', 'Bank Charges',                   'expense', 'Admin',           'debit',  'Bank service fees on development account.'),
    (dev_id, '5600', 'Professional Fees',              'expense', 'Professional',    'debit',  'Legal, accounting, architect, engineer fees.'),
    (dev_id, '5700', 'Interest — Bridging Finance',    'expense', 'Finance',         'debit',  'Interest on bridging loans. Deductible against trading income.'),
    (dev_id, '5800', 'Income Tax Expense (CIT 27%)',   'expense', 'Tax',             'debit',  'Current tax expense at 27% on taxable profit.');

  RAISE NOTICE '✓ Bonthuys Developments (Pty) Ltd entity and accounts created';

  -- ── 10. REASSIGN ASSETS to Maria personal entity ───────────────────────────

  SELECT id INTO land_asset_id   FROM assets WHERE name = 'Vacant Land';
  SELECT id INTO shares_asset_id FROM assets WHERE name = 'EasyEquities USD Portfolio';

  IF land_asset_id IS NOT NULL THEN
    UPDATE assets
    SET entity_id = maria_id,
        notes     = 'Freehold vacant stand. Currently Maria J. Bonthuys personal property — NOT yet transferred. '
                    'Pending: structured transfer to Bonthuys Family Trust post-registration. '
                    'Options: (a) donate within R100k annual exemption (phased over years), '
                    '(b) sell to trust at market value with S7C-compliant loan. '
                    'Original cost R345,000. No improvements. No transfer duty. CGT base cost = R345,000. '
                    'Annual R40,000 CGT exclusion available while in Maria''s personal name.'
    WHERE id = land_asset_id;
    RAISE NOTICE '✓ Vacant Land reassigned to Maria personal entity';
  ELSE
    RAISE NOTICE '⚠ Vacant Land asset not found — may already be reassigned';
  END IF;

  IF shares_asset_id IS NOT NULL THEN
    UPDATE assets
    SET entity_id = maria_id,
        notes     = 'USD-denominated shares held on EasyEquities platform. '
                    'Currently Maria J. Bonthuys personal property — NOT yet in trust. '
                    'Pending: transfer to Bonthuys Family Trust. '
                    'Transfer while portfolio value is still small to minimise CGT exposure. '
                    'Annual R40,000 CGT exclusion available while in Maria''s personal name. '
                    'Update current_value_zar quarterly: ZAR/USD rate × USD portfolio value.'
    WHERE id = shares_asset_id;
    RAISE NOTICE '✓ EasyEquities Portfolio reassigned to Maria personal entity';
  ELSE
    RAISE NOTICE '⚠ EasyEquities asset not found — may already be reassigned';
  END IF;

  -- ── 11. ADD MARIUS'S LIFE POLICY (pending cession to trust) ───────────────

  INSERT INTO trust_life_policies
    (policy_number, insurer, insured_person, sum_assured_zar, annual_premium_zar, trust_owns_policy, notes)
  VALUES
    (NULL,
     'Unknown — confirm from policy schedule',
     'Marius Bonthuys',
     10000000,
     NULL,
     false,
     'R10,000,000 life policy. CURRENTLY: Marius Bonthuys is owner and premium payer — '
     'proceeds INSIDE his estate (estate duty applies: 20% × R10m = R2m to SARS). '
     'REQUIRED ACTION: Cede policy ownership to Bonthuys Family Trust after registration. '
     'Trust must then pay premiums from trust funds (management fee income or donations). '
     'Once ceded and trust pays premiums: proceeds OUTSIDE estate — R2m estate duty saved. '
     'trust_owns_policy will be updated to TRUE after cession is formalised. '
     'Update policy_number and annual_premium_zar from policy schedule.');

  RAISE NOTICE '✓ Life policy record added (pending cession to trust)';

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 005 complete. Summary of changes:';
  RAISE NOTICE '  • Entity notes updated (tenbucks-mobile + trust)';
  RAISE NOTICE '  • Trustee roles: Maria = Founder & Trustee, Marius = Trustee';
  RAISE NOTICE '  • Beneficiary names: full legal names updated';
  RAISE NOTICE '  • S7C loan deactivated (land not transferred)';
  RAISE NOTICE '  • Account names corrected (company + trust)';
  RAISE NOTICE '  • Trust: 11 new property/income accounts added';
  RAISE NOTICE '  • New entity: Maria J. Bonthuys (Personal) — ID: %', maria_id;
  RAISE NOTICE '  • New entity: Bonthuys Developments (Pty) Ltd — ID: %', dev_id;
  RAISE NOTICE '  • Assets reassigned to Maria personal entity';
  RAISE NOTICE '  • Life policy record added (trust_owns_policy = false pending cession)';
  RAISE NOTICE '═══════════════════════════════════════════════════════';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Fix clause 6.2 in trust deed (incomplete secondary beneficiary)';
  RAISE NOTICE '  2. Register trust with Master of the High Court';
  RAISE NOTICE '  3. Transfer tenbucks-mobile shares to trust (while equity is still low)';
  RAISE NOTICE '  4. Open trust bank account + SARS IT12T registration';
  RAISE NOTICE '  5. Cede life policy to trust; update trust_owns_policy = true';
  RAISE NOTICE '  6. Update beneficiary DOBs from birth certificates';
  RAISE NOTICE '  7. Update life policy number and annual premium';
  RAISE NOTICE '  8. Begin annual R100k donations (Maria + Marius) to trust capital';

END $$;
