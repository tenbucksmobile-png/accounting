-- tenbucks-mobile (Pty) Ltd
-- Bank account opening deposit + bank fees (March, April, May 2026)
-- Run BEFORE the closing entries SQL
-- Run in Supabase SQL Editor

DO $$
DECLARE
  v_entity_id     uuid;
  v_bank_acct     uuid;   -- Asset: Bank
  v_bank_fee_acct uuid;   -- Expense: Bank Charges / Bank Fees
  v_capital_acct  uuid;   -- Equity: Share Capital / Capital
  v_entry_id      uuid;
BEGIN

  -- ── Entity ────────────────────────────────────────────────────────────────
  SELECT id INTO v_entity_id
  FROM entities WHERE name = 'tenbucks-mobile (Pty) Ltd';
  IF v_entity_id IS NULL THEN RAISE EXCEPTION 'Entity not found'; END IF;

  -- ── Accounts ──────────────────────────────────────────────────────────────
  SELECT id INTO v_bank_acct FROM accounts
  WHERE entity_id = v_entity_id AND type = 'asset' AND name ILIKE '%bank%'
  ORDER BY code LIMIT 1;

  SELECT id INTO v_bank_fee_acct FROM accounts
  WHERE entity_id = v_entity_id AND type = 'expense'
    AND (name ILIKE '%bank charge%' OR name ILIKE '%bank fee%' OR name ILIKE '%service fee%' OR name ILIKE '%charge%')
  ORDER BY code LIMIT 1;

  SELECT id INTO v_capital_acct FROM accounts
  WHERE entity_id = v_entity_id AND type = 'equity'
    AND (name ILIKE '%share capital%' OR name ILIKE '%capital%' OR name ILIKE '%paid%')
  ORDER BY code LIMIT 1;

  -- ── Validate ──────────────────────────────────────────────────────────────
  IF v_bank_acct     IS NULL THEN RAISE EXCEPTION 'Bank account not found';          END IF;
  IF v_bank_fee_acct IS NULL THEN RAISE EXCEPTION 'Bank charges account not found'; END IF;
  IF v_capital_acct  IS NULL THEN RAISE EXCEPTION 'Share capital account not found'; END IF;

  RAISE NOTICE 'Bank:          % (%)', (SELECT name FROM accounts WHERE id = v_bank_acct),     v_bank_acct;
  RAISE NOTICE 'Bank charges:  % (%)', (SELECT name FROM accounts WHERE id = v_bank_fee_acct), v_bank_fee_acct;
  RAISE NOTICE 'Share capital: % (%)', (SELECT name FROM accounts WHERE id = v_capital_acct),  v_capital_acct;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 1. BANK ACCOUNT OPENING DEPOSIT — R50.00
  --    Dr Bank R50.00 / Cr Share Capital R50.00
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO journal_entries
    (entity_id, entry_date, description, reference, source, is_reconciled)
  VALUES
    (v_entity_id, '2026-03-01',
     'Bank account opening deposit', 'DEP-2026-001', 'manual', true)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (v_entry_id, v_bank_acct,    50,  0, 'Opening deposit — bank account activation'),
    (v_entry_id, v_capital_acct,  0, 50, 'Share capital — opening deposit');

  RAISE NOTICE '✓ Opening deposit posted: Dr Bank R50 / Cr Share Capital R50';

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2. BANK FEES — March 2026 — R29.39
  --    Dr Bank Charges R29.39 / Cr Bank R29.39
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO journal_entries
    (entity_id, entry_date, description, reference, source, is_reconciled)
  VALUES
    (v_entity_id, '2026-03-31',
     'Bank service fees — March 2026', 'BF-2026-03', 'manual', true)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (v_entry_id, v_bank_fee_acct, 29.39,     0, 'Bank service fees — March 2026'),
    (v_entry_id, v_bank_acct,         0, 29.39, 'Bank deduction — March fees');

  RAISE NOTICE '✓ March bank fees posted: R29.39';

  -- ══════════════════════════════════════════════════════════════════════════
  -- 3. BANK FEES — April 2026 — R49.00
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO journal_entries
    (entity_id, entry_date, description, reference, source, is_reconciled)
  VALUES
    (v_entity_id, '2026-04-30',
     'Bank service fees — April 2026', 'BF-2026-04', 'manual', true)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (v_entry_id, v_bank_fee_acct, 49,  0, 'Bank service fees — April 2026'),
    (v_entry_id, v_bank_acct,      0, 49, 'Bank deduction — April fees');

  RAISE NOTICE '✓ April bank fees posted: R49.00';

  -- ══════════════════════════════════════════════════════════════════════════
  -- 4. BANK FEES — May 2026 — R54.00
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO journal_entries
    (entity_id, entry_date, description, reference, source, is_reconciled)
  VALUES
    (v_entity_id, '2026-05-31',
     'Bank service fees — May 2026', 'BF-2026-05', 'manual', true)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (v_entry_id, v_bank_fee_acct, 54,  0, 'Bank service fees — May 2026'),
    (v_entry_id, v_bank_acct,      0, 54, 'Bank deduction — May fees');

  RAISE NOTICE '✓ May bank fees posted: R54.00';
  RAISE NOTICE '';
  RAISE NOTICE 'Total bank fees (Mar–May): R132.39';

END $$;
