-- Indaba Cares App — License Fee journal entries
-- tenbucks-mobile (Pty) Ltd | March, April, May 2026 | R9,800 each
-- Run in Supabase SQL Editor

DO $$
DECLARE
  v_entity_id       uuid;
  v_debit_acct      uuid;   -- Trade Debtors / Accounts Receivable
  v_credit_acct     uuid;   -- License Fee / Software Revenue
  v_entry_id        uuid;
BEGIN

  -- Entity
  SELECT id INTO v_entity_id
  FROM entities
  WHERE name = 'tenbucks-mobile (Pty) Ltd';

  IF v_entity_id IS NULL THEN
    RAISE EXCEPTION 'Entity "tenbucks-mobile (Pty) Ltd" not found';
  END IF;

  -- Debit: Trade Debtors / Accounts Receivable (asset)
  SELECT id INTO v_debit_acct
  FROM accounts
  WHERE entity_id = v_entity_id
    AND type = 'asset'
    AND (name ILIKE '%debtor%' OR name ILIKE '%receivable%')
  ORDER BY code
  LIMIT 1;

  IF v_debit_acct IS NULL THEN
    RAISE EXCEPTION 'No debtors/receivable account found — check account names in Chart of Accounts';
  END IF;

  -- Credit: License Fee / Software Revenue (income)
  SELECT id INTO v_credit_acct
  FROM accounts
  WHERE entity_id = v_entity_id
    AND type = 'income'
    AND (name ILIKE '%license%' OR name ILIKE '%software%' OR name ILIKE '%revenue%' OR name ILIKE '%income%')
  ORDER BY code
  LIMIT 1;

  IF v_credit_acct IS NULL THEN
    RAISE EXCEPTION 'No income account found — check account names in Chart of Accounts';
  END IF;

  RAISE NOTICE 'Using debit account:  % (id: %)', (SELECT name FROM accounts WHERE id = v_debit_acct), v_debit_acct;
  RAISE NOTICE 'Using credit account: % (id: %)', (SELECT name FROM accounts WHERE id = v_credit_acct), v_credit_acct;

  -- ── March 2026 ────────────────────────────────────────────────────────────
  INSERT INTO journal_entries (entity_id, entry_date, description, reference, source, is_reconciled)
  VALUES (v_entity_id, '2026-03-01', 'Indaba Cares App — Monthly License Fee (March 2026)', 'INV-2026-001', 'manual', false)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
  VALUES
    (v_entry_id, v_debit_acct,  9800,    0, 'The Sandton Indaba — INV-2026-001'),
    (v_entry_id, v_credit_acct,    0, 9800, 'Indaba Cares App license fee — March 2026');

  -- ── April 2026 ────────────────────────────────────────────────────────────
  INSERT INTO journal_entries (entity_id, entry_date, description, reference, source, is_reconciled)
  VALUES (v_entity_id, '2026-04-01', 'Indaba Cares App — Monthly License Fee (April 2026)', 'INV-2026-002', 'manual', false)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
  VALUES
    (v_entry_id, v_debit_acct,  9800,    0, 'The Sandton Indaba — INV-2026-002'),
    (v_entry_id, v_credit_acct,    0, 9800, 'Indaba Cares App license fee — April 2026');

  -- ── May 2026 ──────────────────────────────────────────────────────────────
  INSERT INTO journal_entries (entity_id, entry_date, description, reference, source, is_reconciled)
  VALUES (v_entity_id, '2026-05-01', 'Indaba Cares App — Monthly License Fee (May 2026)', 'INV-2026-003', 'manual', false)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
  VALUES
    (v_entry_id, v_debit_acct,  9800,    0, 'The Sandton Indaba — INV-2026-003'),
    (v_entry_id, v_credit_acct,    0, 9800, 'Indaba Cares App license fee — May 2026');

  RAISE NOTICE 'Done — 3 entries posted. Total: R29,400 Dr Trade Debtors / Cr License Income';

END $$;
