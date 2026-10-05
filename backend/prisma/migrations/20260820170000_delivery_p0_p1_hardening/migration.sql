-- Delivery P0/P1 hardening. Do not apply this migration to a shared database
-- until migration status and a disposable rehearsal have passed.

-- Signed-offer resubmission must have a recoverable, short-lived encrypted
-- token envelope distinct from the original offer-response token.
ALTER TABLE "job_offers"
  ADD COLUMN IF NOT EXISTS "signatureResubmissionTokenCiphertext" TEXT;

-- Delivery V2 writers must not fall back to the legacy global operation key.
DROP INDEX IF EXISTS "delivery_command_receipts_operationId_key";

-- V2 company-scoped suppression is the only active suppression form. Existing
-- Company Group rows must be reconciled before making companyId mandatory.
CREATE INDEX IF NOT EXISTS "email_suppressions_companyId_active_idx"
  ON "email_suppressions" ("companyId", "addressHmac")
  WHERE "releasedAt" IS NULL AND "companyId" IS NOT NULL;

-- New delivery attempt rows are append-only evidence. Prisma does not issue
-- updates/deletes for attempts, and direct SQL is rejected.
CREATE OR REPLACE FUNCTION delivery_attempts_append_only_guard()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'DELIVERY_ATTEMPT_APPEND_ONLY';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS delivery_attempts_append_only ON "delivery_attempts";
CREATE TRIGGER delivery_attempts_append_only
BEFORE UPDATE OR DELETE ON "delivery_attempts"
FOR EACH ROW EXECUTE FUNCTION delivery_attempts_append_only_guard();

-- V2 receipt integrity: legacy all-null rows remain readable; new rows have
-- complete request-proof metadata. The application provides Company scope.
ALTER TABLE "delivery_command_receipts"
  DROP CONSTRAINT IF EXISTS "delivery_command_receipts_request_hash_shape_chk";
ALTER TABLE "delivery_command_receipts"
  ADD CONSTRAINT "delivery_command_receipts_request_hash_shape_chk"
  CHECK (
    ("requestHash" IS NULL AND "requestHashKeyVersion" IS NULL AND "requestHashFormatVersion" IS NULL)
    OR
    ("requestHash" IS NOT NULL AND "requestHashKeyVersion" IS NOT NULL AND "requestHashFormatVersion" IS NOT NULL)
  );

-- Recipient-resolution exceptions are durable operational work, not log rows.
ALTER TYPE "DeliveryRecipientExceptionStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "DeliveryRecipientExceptionStatus" ADD VALUE IF NOT EXISTS 'DISMISSED';

ALTER TABLE "delivery_recipient_exceptions"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "resolvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionReason" TEXT;

ALTER TABLE "delivery_recipient_exceptions"
  DROP CONSTRAINT IF EXISTS "delivery_recipient_exceptions_terminal_evidence_chk";
ALTER TABLE "delivery_recipient_exceptions"
  ADD CONSTRAINT "delivery_recipient_exceptions_terminal_evidence_chk"
  CHECK (
    ("status" = 'OPEN' AND "resolvedAt" IS NULL AND "resolvedByUserId" IS NULL)
    OR
    ("status" IN ('ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')
      AND "resolvedAt" IS NOT NULL
      AND "resolvedByUserId" IS NOT NULL
      AND "resolutionReason" IS NOT NULL)
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS "delivery_recipient_exceptions_companyId_status_createdAt_idx"
  ON "delivery_recipient_exceptions" ("companyId", "status", "createdAt");
