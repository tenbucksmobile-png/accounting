-- tenbucks-mobile (Pty) Ltd
-- REVISED: Consulting fee (May) + month-end closing entries (March, April, May 2026)
-- NOW INCLUDES bank fees in closing calculations
-- Run AFTER: post-journal-entries-indaba-cares.sql AND post-bank-fees-and-opening-deposit.sql
-- Run in Supabase SQL Editor

DO $$
DECLARE
  v_entity_id        uuid;
  v_bank_acct        uuid;
  v_consulting_acct  uuid;
  v_bank_fee_acct    uuid;
  v_income_acct      uuid;
  v_retained_acct    uuid;
  v_entry_id         uuid;
BEGIN

  -- ── Entity ────────────────────────────────────────────────────────────────
  SELECT id INTO v_entity_id
  FROM entities WHERE name = 'tenbucks-mobile (Pty) Ltd';
  IF v_entity_id IS NULL THEN RAISE EXCEPTION 'Entity not found'; END IF;

  -- ── Accounts ──────────────────────────────────────────────────────────────
  SELECT id INTO v_bank_acct FROM accounts
  WHERE entity_id = v_entity_id AND type = 'asset' AND name ILIKE '%bank%'
  ORDER BY code LIMIT 1;

  SELECT id INTO v_consulting_acct FROM accounts
  WHERE entity_id = v_entity_id AND type = 'expense'
    AND (name ILIKE '%consult%' OR name ILIKE '%professional%' OR name ILIKE '%management%')
  ORDER BY code LIMIT 1;

  SELECT id INTO v_bank_fee_acct FROM accounts
  WHERE entity_id = v_entity_id AND type = 'expense'
    AND (name ILIKE '%bank charge%' OR name ILIKE '%bank fee%' OR name ILIKE '%service fee%' OR name ILIKE '%charge%')
  ORDER BY code LIMIT 1;

  SELECT id INTO v_income_acct FROM accounts
  WHERE entity_id = v_entity_id AND type = 'income'
    AND (name ILIKE '%license%' OR name ILIKE '%software%' OR name ILIKE '%revenue%' OR name ILIKE '%income%')
  ORDER BY code LIMIT 1;

  SELECT id INTO v_retained_acct FROM accounts
  WHERE entity_id = v_entity_id AND type = 'equity'
    AND (name ILIKE '%retain%' OR name ILIKE '%profit%' OR name ILIKE '%earning%' OR name ILIKE '%accumul%')
  ORDER BY code LIMIT 1;

  -- ── Validate ──────────────────────────────────────────────────────────────
  IF v_bank_acct       IS NULL THEN RAISE EXCEPTION 'Bank account not found';           END IF;
  IF v_consulting_acct IS NULL THEN RAISE EXCEPTION 'Consulting account not found';     END IF;
  IF v_bank_fee_acct   IS NULL THEN RAISE EXCEPTION 'Bank charges account not found';   END IF;
  IF v_income_acct     IS NULL THEN RAISE EXCEPTION 'Income account not found';         END IF;
  IF v_retained_acct   IS NULL THEN RAISE EXCEPTION 'Retained Earnings not found';      END IF;

  RAISE NOTICE 'Consulting:        % (%)', (SELECT name FROM accounts WHERE id = v_consulting_acct), v_consulting_acct;
  RAISE NOTICE 'Bank charges:      % (%)', (SELECT name FROM accounts WHERE id = v_bank_fee_acct),   v_bank_fee_acct;
  RAISE NOTICE 'Income:            % (%)', (SELECT name FROM accounts WHERE id = v_income_acct),     v_income_acct;
  RAISE NOTICE 'Retained Earnings: % (%)', (SELECT name FROM accounts WHERE id = v_retained_acct),   v_retained_acct;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 1. CONSULTING FEE — May 2026 (CF-2026-001)
  --    Dr Consulting Fees R3,500 / Cr Bank R3,500
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO journal_entries
    (entity_id, entry_date, description, reference, source, is_reconciled)
  VALUES
    (v_entity_id, '2026-05-31',
     'Consulting fee — Marius Bonthuys (May 2026)', 'CF-2026-001', 'manual', true)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (v_entry_id, v_consulting_acct, 3500,    0, 'Consulting fee — Marius Bonthuys'),
    (v_entry_id, v_bank_acct,          0, 3500, 'Payment to Marius Bonthuys — May 2026');

  RAISE NOTICE '✓ Consulting fee posted (CF-2026-001): Dr Consulting R3,500 / Cr Bank R3,500';

  -- ══════════════════════════════════════════════════════════════════════════
  -- 2. CLOSE — March 2026 (CLOSE-2026-03)
  --    Income R9,800 | Bank fees R29.39 | Net profit R9,770.61
  --    Dr Income R9,800 / Cr Bank Charges R29.39 / Cr Retained Earnings R9,770.61
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO journal_entries
    (entity_id, entry_date, description, reference, source, is_reconciled)
  VALUES
    (v_entity_id, '2026-03-31',
     'Month-end closing entry — March 2026 (IFRS IAS 1)', 'CLOSE-2026-03', 'manual', true)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (v_entry_id, v_income_acct,    9800,       0, 'Close: license fee income — March 2026'),
    (v_entry_id, v_bank_fee_acct,     0,   29.39, 'Close: bank charges — March 2026'),
    (v_entry_id, v_retained_acct,     0, 9770.61, 'Net profit March 2026 (R9,800 less R29.39 bank fees)');

  RAISE NOTICE '✓ March 2026 closed: Net profit R9,770.61 → Retained Earnings';

  -- ══════════════════════════════════════════════════════════════════════════
  -- 3. CLOSE — April 2026 (CLOSE-2026-04)
  --    Income R9,800 | Bank fees R49.00 | Net profit R9,751.00
  --    Dr Income R9,800 / Cr Bank Charges R49 / Cr Retained Earnings R9,751
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO journal_entries
    (entity_id, entry_date, description, reference, source, is_reconciled)
  VALUES
    (v_entity_id, '2026-04-30',
     'Month-end closing entry — April 2026 (IFRS IAS 1)', 'CLOSE-2026-04', 'manual', true)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (v_entry_id, v_income_acct,    9800,      0, 'Close: license fee income — April 2026'),
    (v_entry_id, v_bank_fee_acct,     0,     49, 'Close: bank charges — April 2026'),
    (v_entry_id, v_retained_acct,     0,   9751, 'Net profit April 2026 (R9,800 less R49 bank fees)');

  RAISE NOTICE '✓ April 2026 closed: Net profit R9,751.00 → Retained Earnings';

  -- ══════════════════════════════════════════════════════════════════════════
  -- 4. CLOSE — May 2026 (CLOSE-2026-05)
  --    Income R9,800 | Consulting R3,500 | Bank fees R54 | Net profit R6,246
  --    Dr Income R9,800 / Cr Consulting R3,500 / Cr Bank Charges R54 / Cr RE R6,246
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO journal_entries
    (entity_id, entry_date, description, reference, source, is_reconciled)
  VALUES
    (v_entity_id, '2026-05-31',
     'Month-end closing entry — May 2026 (IFRS IAS 1)', 'CLOSE-2026-05', 'manual', true)
  RETURNING id INTO v_entry_id;

  INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES
    (v_entry_id, v_income_acct,       9800,    0, 'Close: license fee income — May 2026'),
    (v_entry_id, v_consulting_acct,      0, 3500, 'Close: consulting fee expense — May 2026'),
    (v_entry_id, v_bank_fee_acct,        0,   54, 'Close: bank charges — May 2026'),
    (v_entry_id, v_retained_acct,        0, 6246, 'Net profit May 2026 (R9,800 less R3,500 consulting less R54 bank fees)');

  RAISE NOTICE '✓ May 2026 closed: Net profit R6,246.00 → Retained Earnings';

  -- ── Quarter summary ───────────────────────────────────────────────────────
  RAISE NOTICE '';
  RAISE NOTICE '══ Quarter summary (Mar–May 2026) ══';
  RAISE NOTICE 'Revenue:          R29,400.00';
  RAISE NOTICE 'Consulting fees:  R3,500.00';
  RAISE NOTICE 'Bank fees:        R132.39';
  RAISE NOTICE 'Total expenses:   R3,632.39';
  RAISE NOTICE 'Net profit:       R25,767.61 → Retained Earnings';
  RAISE NOTICE 'CIT provision:    R6,957.26 (@ 27%%)';

END $$;
