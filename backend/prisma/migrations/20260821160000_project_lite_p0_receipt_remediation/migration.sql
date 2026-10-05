-- Project Lite P0 remediation (PRJ-P0-01): receipt CLAIMED → COMPLETED once.
-- Apply after project_lite_contract / file_session_binding. Safe to re-run pieces
-- with IF EXISTS / OR REPLACE. Do not apply to shared DB until Phase 0 ordering
-- with Office Finance migrations is reconciled.

ALTER TABLE "project_command_receipts"
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Backfill receipts that already stored a result before completedAt existed.
UPDATE "project_command_receipts"
SET "completedAt" = COALESCE("completedAt", "createdAt")
WHERE "safeResultSnapshot" IS NOT NULL
  AND "resultEntityType" IS NOT NULL
  AND "resultEntityId" IS NOT NULL
  AND "completedAt" IS NULL;

CREATE OR REPLACE FUNCTION project_command_receipt_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE');
  END IF;

  IF OLD."safeResultSnapshot" IS NULL
     AND OLD."resultEntityType" IS NULL
     AND OLD."resultEntityId" IS NULL
     AND OLD."completedAt" IS NULL
     AND NEW."safeResultSnapshot" IS NOT NULL
     AND NEW."resultEntityType" IS NOT NULL
     AND NEW."resultEntityId" IS NOT NULL
     AND NEW."completedAt" IS NOT NULL
     AND NEW.id = OLD.id
     AND NEW."companyId" = OLD."companyId"
     AND NEW."operationId" = OLD."operationId"
     AND NEW."commandType" = OLD."commandType"
     AND NEW."actorUserId" = OLD."actorUserId"
     AND NEW."requestHash" = OLD."requestHash"
     AND NEW."requestHashKeyVersion" = OLD."requestHashKeyVersion"
     AND NEW."requestHashFormatVersion" = OLD."requestHashFormatVersion"
     AND NEW."createdAt" = OLD."createdAt"
  THEN
    RETURN NEW;
  END IF;

  PERFORM project_lite_raise('PROJECT_HISTORY_IMMUTABLE');
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_command_receipts_immutable ON project_command_receipts;
CREATE TRIGGER trg_project_command_receipts_immutable
  BEFORE UPDATE OR DELETE ON project_command_receipts
  FOR EACH ROW
  EXECUTE FUNCTION project_command_receipt_guard();
