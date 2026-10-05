-- Office Finance Lite contract: immutability and shape backstops.

-- Prevent hard-delete of approved/reversed finance transactions
CREATE OR REPLACE FUNCTION finance_prevent_history_delete()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('APPROVED', 'REVERSED') THEN
    RAISE EXCEPTION 'FINANCE_HISTORY_IMMUTABLE: approved/reversed transactions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_transactions_prevent_delete ON "finance_transactions";
CREATE TRIGGER finance_transactions_prevent_delete
  BEFORE DELETE ON "finance_transactions"
  FOR EACH ROW EXECUTE FUNCTION finance_prevent_history_delete();

-- Self-approval guard on status transition to APPROVED
CREATE OR REPLACE FUNCTION finance_prevent_self_approval()
RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'APPROVED'
     AND NEW."approvedByUserId" IS NOT NULL
     AND NEW."createdByUserId" = NEW."approvedByUserId" THEN
    RAISE EXCEPTION 'FINANCE_SELF_APPROVAL_FORBIDDEN';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_transactions_self_approval ON "finance_transactions";
CREATE TRIGGER finance_transactions_self_approval
  BEFORE INSERT OR UPDATE ON "finance_transactions"
  FOR EACH ROW EXECUTE FUNCTION finance_prevent_self_approval();

-- One reversal per original
CREATE UNIQUE INDEX IF NOT EXISTS "finance_transactions_reversalOf_unique"
  ON "finance_transactions"("reversalOfTransactionId")
  WHERE "reversalOfTransactionId" IS NOT NULL;
