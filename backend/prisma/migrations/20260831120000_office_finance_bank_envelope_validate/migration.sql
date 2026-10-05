-- Contract: validate bank-envelope completeness after expand (NOT VALID) and
-- operator backfill (`pnpm office-finance-payroll:backfill`). Fails closed if
-- incomplete envelopes remain.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'finance_payment_accounts_bank_envelope_chk'
  ) THEN
    ALTER TABLE "finance_payment_accounts"
      VALIDATE CONSTRAINT finance_payment_accounts_bank_envelope_chk;
  END IF;
END $$;
