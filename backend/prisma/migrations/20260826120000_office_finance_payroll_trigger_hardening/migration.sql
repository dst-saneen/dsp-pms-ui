-- Harden reversal exemption against original-row status and duplicate reversals.
-- Rewrite trigger bodies to the live Prisma column names.

CREATE OR REPLACE FUNCTION finance_prevent_self_approval()
RETURNS trigger AS $$
DECLARE
  original "finance_transactions"%ROWTYPE;
  existing_reversal_id text;
BEGIN
  IF NEW."status" = 'APPROVED'
     AND NEW."approvedByUserId" IS NOT NULL
     AND NEW."createdByUserId" = NEW."approvedByUserId" THEN
    IF NEW."sourceType" = 'REVERSAL'
       AND NEW."reversalOfTransactionId" IS NOT NULL
       AND NEW."reversedByUserId" IS NOT NULL
       AND NEW."reversedAt" IS NOT NULL
       AND COALESCE(BTRIM(NEW."reverseReason"), '') <> '' THEN
      SELECT * INTO original
      FROM "finance_transactions"
      WHERE "id" = NEW."reversalOfTransactionId"
        AND "companyId" = NEW."companyId"
      FOR SHARE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'FINANCE_SELF_APPROVAL_FORBIDDEN';
      END IF;

      IF original."status" NOT IN ('APPROVED', 'REVERSED') THEN
        RAISE EXCEPTION 'FINANCE_SELF_APPROVAL_FORBIDDEN';
      END IF;

      IF original."sourceType" = 'REVERSAL' THEN
        RAISE EXCEPTION 'FINANCE_SELF_APPROVAL_FORBIDDEN';
      END IF;

      SELECT t."id" INTO existing_reversal_id
      FROM "finance_transactions" t
      WHERE t."companyId" = NEW."companyId"
        AND t."reversalOfTransactionId" = NEW."reversalOfTransactionId"
        AND t."id" IS DISTINCT FROM NEW."id"
      LIMIT 1;

      IF existing_reversal_id IS NOT NULL THEN
        RAISE EXCEPTION 'FINANCE_REVERSAL_ALREADY_EXISTS';
      END IF;

      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'FINANCE_SELF_APPROVAL_FORBIDDEN';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION finance_validate_reversal_copy()
RETURNS trigger AS $$
DECLARE
  original "finance_transactions"%ROWTYPE;
BEGIN
  IF NEW."sourceType" <> 'REVERSAL' THEN
    RETURN NEW;
  END IF;

  IF NEW."reversalOfTransactionId" IS NULL
     OR NEW."reversedByUserId" IS NULL
     OR NEW."reversedAt" IS NULL
     OR COALESCE(BTRIM(NEW."reverseReason"), '') = '' THEN
    RAISE EXCEPTION 'FINANCE_REVERSAL_INVALID';
  END IF;

  SELECT * INTO original
  FROM "finance_transactions"
  WHERE "id" = NEW."reversalOfTransactionId"
    AND "companyId" = NEW."companyId"
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FINANCE_REVERSAL_INVALID';
  END IF;

  IF TG_OP = 'INSERT' AND original."status" <> 'APPROVED' THEN
    RAISE EXCEPTION 'FINANCE_REVERSAL_INVALID';
  END IF;

  IF TG_OP = 'UPDATE' AND original."status" NOT IN ('APPROVED', 'REVERSED') THEN
    RAISE EXCEPTION 'FINANCE_REVERSAL_INVALID';
  END IF;

  IF original."sourceType" = 'REVERSAL' THEN
    RAISE EXCEPTION 'FINANCE_REVERSAL_INVALID';
  END IF;

  IF NEW."amount" IS DISTINCT FROM original."amount"
     OR NEW."taxAmount" IS DISTINCT FROM original."taxAmount"
     OR NEW."currencyCode" IS DISTINCT FROM original."currencyCode"
     OR NEW."transactionType" IS DISTINCT FROM original."transactionType"
     OR NEW."sourceAccountId" IS DISTINCT FROM original."sourceAccountId"
     OR NEW."destinationAccountId" IS DISTINCT FROM original."destinationAccountId"
     OR NEW."categoryId" IS DISTINCT FROM original."categoryId"
     OR NEW."branchId" IS DISTINCT FROM original."branchId"
     OR NEW."departmentId" IS DISTINCT FROM original."departmentId"
     OR NEW."projectId" IS DISTINCT FROM original."projectId"
     OR NEW."businessPartyId" IS DISTINCT FROM original."businessPartyId"
     OR NEW."employeeId" IS DISTINCT FROM original."employeeId" THEN
    RAISE EXCEPTION 'FINANCE_REVERSAL_INVALID';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION finance_prevent_approved_update()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'REVERSED' THEN
    RAISE EXCEPTION 'FINANCE_HISTORY_IMMUTABLE: reversed transactions cannot be edited';
  END IF;

  IF OLD."status" = 'APPROVED' AND OLD."sourceType" = 'REVERSAL' THEN
    RAISE EXCEPTION 'FINANCE_HISTORY_IMMUTABLE: approved reversal rows cannot be edited';
  END IF;

  IF OLD."status" = 'APPROVED' AND NEW."status" = 'REVERSED' THEN
    IF NEW."amount" IS DISTINCT FROM OLD."amount"
       OR NEW."taxAmount" IS DISTINCT FROM OLD."taxAmount"
       OR NEW."transactionDate" IS DISTINCT FROM OLD."transactionDate"
       OR NEW."transactionType" IS DISTINCT FROM OLD."transactionType"
       OR NEW."categoryId" IS DISTINCT FROM OLD."categoryId"
       OR NEW."sourceAccountId" IS DISTINCT FROM OLD."sourceAccountId"
       OR NEW."destinationAccountId" IS DISTINCT FROM OLD."destinationAccountId"
       OR NEW."businessPartyId" IS DISTINCT FROM OLD."businessPartyId"
       OR NEW."employeeId" IS DISTINCT FROM OLD."employeeId"
       OR NEW."departmentId" IS DISTINCT FROM OLD."departmentId"
       OR NEW."projectId" IS DISTINCT FROM OLD."projectId"
       OR NEW."description" IS DISTINCT FROM OLD."description"
       OR NEW."currencyCode" IS DISTINCT FROM OLD."currencyCode"
       OR NEW."reference" IS DISTINCT FROM OLD."reference"
       OR NEW."sourceType" IS DISTINCT FROM OLD."sourceType"
       OR NEW."sourceId" IS DISTINCT FROM OLD."sourceId"
       OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
       OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId"
       OR NEW."approvedByUserId" IS DISTINCT FROM OLD."approvedByUserId"
       OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
       OR NEW."transactionNumber" IS DISTINCT FROM OLD."transactionNumber"
       OR NEW."reversedByTransactionId" IS NULL THEN
      RAISE EXCEPTION 'FINANCE_HISTORY_IMMUTABLE: approved transactions cannot be edited';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" IN ('APPROVED', 'REVERSED') THEN
    RAISE EXCEPTION 'FINANCE_HISTORY_IMMUTABLE: approved/reversed transactions cannot be edited';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION finance_prevent_opening_balance_change()
RETURNS trigger AS $$
DECLARE
  movement_count integer;
BEGIN
  IF NEW."openingBalance" IS DISTINCT FROM OLD."openingBalance"
     OR NEW."openingDate" IS DISTINCT FROM OLD."openingDate"
     OR NEW."currencyCode" IS DISTINCT FROM OLD."currencyCode" THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(OLD."id", 0));
    PERFORM 1 FROM "finance_payment_accounts" WHERE "id" = OLD."id" FOR UPDATE;

    SELECT COUNT(*) INTO movement_count
    FROM "finance_transactions" t
    WHERE t."companyId" = OLD."companyId"
      AND t."status" IN ('APPROVED', 'REVERSED')
      AND (t."sourceAccountId" = OLD."id" OR t."destinationAccountId" = OLD."id");
    IF movement_count > 0 THEN
      RAISE EXCEPTION 'FINANCE_OPENING_BALANCE_LOCKED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
