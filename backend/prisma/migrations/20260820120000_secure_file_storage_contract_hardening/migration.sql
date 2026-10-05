-- Corrective contract hardening for secure file storage and signed offers.
-- Do not edit 20260819140000_secure_file_storage_and_signed_offer.

-- ─── Permissions ─────────────────────────────────────────────────────────────

INSERT INTO "permissions" ("id", "code", "name", "description", "updatedAt")
VALUES
  (md5('permission:recruitment.offer.verify'), 'recruitment.offer.verify', 'Verify or reject signed offer submissions', NULL, CURRENT_TIMESTAMP),
  (md5('permission:files.operations.read'), 'files.operations.read', 'View file operations dashboards', NULL, CURRENT_TIMESTAMP),
  (md5('permission:files.operations.manage'), 'files.operations.manage', 'Manage file operations, reconciliation and dead letters', NULL, CURRENT_TIMESTAMP),
  (md5('permission:files.retention.manage'), 'files.retention.manage', 'Approve and manage document retention policies', NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('ORGANIZATION_OWNER', 'recruitment.offer.verify'),
    ('ORGANIZATION_OWNER', 'files.operations.read'),
    ('ORGANIZATION_OWNER', 'files.operations.manage'),
    ('ORGANIZATION_OWNER', 'files.retention.manage'),
    ('COMPANY_ADMINISTRATOR', 'recruitment.offer.verify'),
    ('COMPANY_ADMINISTRATOR', 'files.operations.read'),
    ('COMPANY_ADMINISTRATOR', 'files.operations.manage'),
    ('COMPANY_ADMINISTRATOR', 'files.retention.manage'),
    ('HR_MANAGER', 'recruitment.offer.verify')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT md5('role-permission:' || m."roleCode" || ':' || m."permissionCode"), r."id", p."id"
FROM mappings m
JOIN "roles" r ON r."code" = m."roleCode"
JOIN "permissions" p ON p."code" = m."permissionCode"
ON CONFLICT DO NOTHING;

-- ─── Enum ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "dsp_pms"."FileDocumentMappingKind" AS ENUM (
    'CV','SUPPORTING','GENERATED_OFFER','SIGNED_OFFER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Column expansions ───────────────────────────────────────────────────────

ALTER TABLE "dsp_pms"."file_objects"
  ADD COLUMN IF NOT EXISTS "fileNameEncNonce" TEXT,
  ADD COLUMN IF NOT EXISTS "fileNameEncTag" TEXT;

ALTER TABLE "dsp_pms"."file_upload_sessions"
  ADD COLUMN IF NOT EXISTS "requestDigest" TEXT;

ALTER TABLE "dsp_pms"."file_operation_attempts"
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3);

ALTER TABLE "dsp_pms"."job_offers"
  ADD COLUMN IF NOT EXISTS "signatureResubmissionTokenHash" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureResubmissionExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "job_offers_companyId_branchId_id_key"
  ON "dsp_pms"."job_offers"("companyId", "branchId", "id");

CREATE INDEX IF NOT EXISTS "job_offers_signatureResubmissionTokenHash_idx"
  ON "dsp_pms"."job_offers"("signatureResubmissionTokenHash");

CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_documents_companyId_id_key"
  ON "dsp_pms"."recruitment_documents"("companyId", "id")
  WHERE "companyId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "employee_documents_companyId_id_key"
  ON "dsp_pms"."employee_documents"("companyId", "id")
  WHERE "companyId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "file_operation_attempts_status_next_lease_idx"
  ON "dsp_pms"."file_operation_attempts"("status", "nextAttemptAt", "leaseExpiresAt");

-- ─── Command receipts ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "dsp_pms"."file_command_receipts" (
  "id"                          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId"                   TEXT NOT NULL,
  "operationId"                 TEXT NOT NULL,
  "commandType"                 TEXT NOT NULL,
  "actorUserId"                 TEXT,
  "publicContext"               TEXT,
  "canonicalHashFormatVersion"  TEXT NOT NULL DEFAULT 'v1',
  "hmacKeyVersion"              TEXT,
  "requestDigest"               TEXT NOT NULL,
  "responseSnapshot"            JSONB NOT NULL,
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "file_command_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "file_command_receipts_companyId_operationId_key"
  ON "dsp_pms"."file_command_receipts"("companyId", "operationId");

CREATE INDEX IF NOT EXISTS "file_command_receipts_companyId_commandType_createdAt_idx"
  ON "dsp_pms"."file_command_receipts"("companyId", "commandType", "createdAt");

ALTER TABLE "dsp_pms"."file_command_receipts"
  DROP CONSTRAINT IF EXISTS "file_command_receipts_companyId_fkey";
ALTER TABLE "dsp_pms"."file_command_receipts"
  ADD CONSTRAINT "file_command_receipts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "dsp_pms"."companies"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ─── Recruitment to Employee document mapping ────────────────────────────────

CREATE TABLE IF NOT EXISTS "dsp_pms"."recruitment_employee_document_mappings" (
  "id"                      TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId"               TEXT NOT NULL,
  "mappingKind"             "dsp_pms"."FileDocumentMappingKind" NOT NULL,
  "employeeDocumentTypeId"  TEXT NOT NULL,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recruitment_employee_document_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_employee_document_mappings_company_kind_key"
  ON "dsp_pms"."recruitment_employee_document_mappings"("companyId", "mappingKind");

ALTER TABLE "dsp_pms"."recruitment_employee_document_mappings"
  DROP CONSTRAINT IF EXISTS "recruitment_employee_document_mappings_companyId_fkey";
ALTER TABLE "dsp_pms"."recruitment_employee_document_mappings"
  ADD CONSTRAINT "recruitment_employee_document_mappings_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "dsp_pms"."companies"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "dsp_pms"."recruitment_employee_document_mappings"
  DROP CONSTRAINT IF EXISTS "recruitment_employee_document_mappings_type_fkey";
ALTER TABLE "dsp_pms"."recruitment_employee_document_mappings"
  ADD CONSTRAINT "recruitment_employee_document_mappings_type_fkey"
  FOREIGN KEY ("employeeDocumentTypeId") REFERENCES "dsp_pms"."employee_document_types"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ─── Tenant composite foreign keys ───────────────────────────────────────────

ALTER TABLE "dsp_pms"."file_objects"
  DROP CONSTRAINT IF EXISTS "file_objects_company_branch_fkey";
ALTER TABLE "dsp_pms"."file_objects"
  ADD CONSTRAINT "file_objects_company_branch_fkey"
  FOREIGN KEY ("companyId", "branchId") REFERENCES "dsp_pms"."branches"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT
  NOT VALID;

ALTER TABLE "dsp_pms"."file_upload_sessions"
  DROP CONSTRAINT IF EXISTS "file_upload_sessions_company_file_object_fkey";
ALTER TABLE "dsp_pms"."file_upload_sessions"
  ADD CONSTRAINT "file_upload_sessions_company_file_object_fkey"
  FOREIGN KEY ("companyId", "fileObjectId") REFERENCES "dsp_pms"."file_objects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT
  NOT VALID;

ALTER TABLE "dsp_pms"."recruitment_documents"
  DROP CONSTRAINT IF EXISTS "recruitment_documents_company_file_object_fkey";
ALTER TABLE "dsp_pms"."recruitment_documents"
  ADD CONSTRAINT "recruitment_documents_company_file_object_fkey"
  FOREIGN KEY ("companyId", "fileObjectId") REFERENCES "dsp_pms"."file_objects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT
  NOT VALID;

ALTER TABLE "dsp_pms"."employee_documents"
  DROP CONSTRAINT IF EXISTS "employee_documents_company_file_object_fkey";
ALTER TABLE "dsp_pms"."employee_documents"
  ADD CONSTRAINT "employee_documents_company_file_object_fkey"
  FOREIGN KEY ("companyId", "fileObjectId") REFERENCES "dsp_pms"."file_objects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT
  NOT VALID;

ALTER TABLE "dsp_pms"."offer_signature_submissions"
  DROP CONSTRAINT IF EXISTS "offer_signature_submissions_company_offer_fkey";
ALTER TABLE "dsp_pms"."offer_signature_submissions"
  ADD CONSTRAINT "offer_signature_submissions_company_offer_fkey"
  FOREIGN KEY ("companyId", "branchId", "jobOfferId") REFERENCES "dsp_pms"."job_offers"("companyId", "branchId", "id")
  ON DELETE RESTRICT ON UPDATE RESTRICT
  NOT VALID;

-- ─── Named CHECKs (NOT VALID so legacy rows stay classified) ─────────────────

ALTER TABLE "dsp_pms"."file_objects"
  DROP CONSTRAINT IF EXISTS "file_objects_clean_evidence_chk";
ALTER TABLE "dsp_pms"."file_objects"
  ADD CONSTRAINT "file_objects_clean_evidence_chk" CHECK (
    "status" <> 'CLEAN'
    OR (
      "actualSizeBytes" IS NOT NULL
      AND "actualChecksumSha256" IS NOT NULL
      AND "detectedMimeType" IS NOT NULL
      AND "clamAvResult" = 'CLEAN'
      AND "scannedAt" IS NOT NULL
      AND "objectKey" LIKE '%/clean/%'
    )
  ) NOT VALID;

ALTER TABLE "dsp_pms"."file_objects"
  DROP CONSTRAINT IF EXISTS "file_objects_infected_failed_evidence_chk";
ALTER TABLE "dsp_pms"."file_objects"
  ADD CONSTRAINT "file_objects_infected_failed_evidence_chk" CHECK (
    "status" NOT IN ('INFECTED', 'SCAN_FAILED')
    OR ("scannedAt" IS NOT NULL AND "clamAvResult" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "dsp_pms"."file_objects"
  DROP CONSTRAINT IF EXISTS "file_objects_encryption_shape_chk";
ALTER TABLE "dsp_pms"."file_objects"
  ADD CONSTRAINT "file_objects_encryption_shape_chk" CHECK (
    ("fileNameEncNonce" IS NULL AND "fileNameEncTag" IS NULL)
    OR ("fileNameEncNonce" IS NOT NULL AND "fileNameEncTag" IS NOT NULL AND "fileNameEncKeyVersion" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "dsp_pms"."file_objects"
  DROP CONSTRAINT IF EXISTS "file_objects_legal_hold_shape_chk";
ALTER TABLE "dsp_pms"."file_objects"
  ADD CONSTRAINT "file_objects_legal_hold_shape_chk" CHECK (
    ("legalHoldAt" IS NULL AND "legalHoldActorId" IS NULL AND "legalHoldReason" IS NULL)
    OR ("legalHoldAt" IS NOT NULL AND "legalHoldActorId" IS NOT NULL AND "legalHoldReason" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "dsp_pms"."file_objects"
  DROP CONSTRAINT IF EXISTS "file_objects_deletion_request_shape_chk";
ALTER TABLE "dsp_pms"."file_objects"
  ADD CONSTRAINT "file_objects_deletion_request_shape_chk" CHECK (
    ("deletionRequestedAt" IS NULL AND "deletionRequestActorId" IS NULL AND "deletionRequestReason" IS NULL)
    OR ("deletionRequestedAt" IS NOT NULL AND "deletionRequestActorId" IS NOT NULL AND "deletionRequestReason" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "dsp_pms"."file_objects"
  DROP CONSTRAINT IF EXISTS "file_objects_legal_hold_blocks_delete_chk";
ALTER TABLE "dsp_pms"."file_objects"
  ADD CONSTRAINT "file_objects_legal_hold_blocks_delete_chk" CHECK (
    "legalHoldAt" IS NULL
    OR "status" NOT IN ('DELETION_PENDING', 'DELETED')
  ) NOT VALID;

ALTER TABLE "dsp_pms"."file_upload_sessions"
  DROP CONSTRAINT IF EXISTS "file_upload_sessions_purpose_target_chk";
ALTER TABLE "dsp_pms"."file_upload_sessions"
  ADD CONSTRAINT "file_upload_sessions_purpose_target_chk" CHECK (
    ("purpose" IN ('CV', 'SUPPORTING') AND ("jobOpeningId" IS NOT NULL OR "jobApplicationId" IS NOT NULL))
    OR ("purpose" = 'EMPLOYEE_DOCUMENT' AND "employeeId" IS NOT NULL)
    OR ("purpose" IN ('SIGNED_OFFER', 'GENERATED_OFFER') AND "jobOfferId" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "dsp_pms"."file_upload_sessions"
  DROP CONSTRAINT IF EXISTS "file_upload_sessions_finalized_object_chk";
ALTER TABLE "dsp_pms"."file_upload_sessions"
  ADD CONSTRAINT "file_upload_sessions_finalized_object_chk" CHECK (
    "status" <> 'CLEAN'
    OR ("fileObjectId" IS NOT NULL AND "finalizedAt" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "dsp_pms"."file_upload_sessions"
  DROP CONSTRAINT IF EXISTS "file_upload_sessions_public_token_chk";
ALTER TABLE "dsp_pms"."file_upload_sessions"
  ADD CONSTRAINT "file_upload_sessions_public_token_chk" CHECK (
    "publicSessionTokenHash" IS NOT NULL
    OR "employeeId" IS NOT NULL
    OR "jobApplicationId" IS NOT NULL
    OR "purpose" = 'GENERATED_OFFER'
  ) NOT VALID;

ALTER TABLE "dsp_pms"."file_operation_attempts"
  DROP CONSTRAINT IF EXISTS "file_operation_attempts_one_target_chk";
ALTER TABLE "dsp_pms"."file_operation_attempts"
  ADD CONSTRAINT "file_operation_attempts_one_target_chk" CHECK (
    (("fileObjectId" IS NOT NULL)::int + ("uploadSessionId" IS NOT NULL)::int) = 1
  ) NOT VALID;

ALTER TABLE "dsp_pms"."file_operation_attempts"
  DROP CONSTRAINT IF EXISTS "file_operation_attempts_terminal_shape_chk";
ALTER TABLE "dsp_pms"."file_operation_attempts"
  ADD CONSTRAINT "file_operation_attempts_terminal_shape_chk" CHECK (
    "status" NOT IN ('SUCCEEDED', 'DEAD_LETTER')
    OR "completedAt" IS NOT NULL
  ) NOT VALID;

ALTER TABLE "dsp_pms"."offer_signature_submissions"
  DROP CONSTRAINT IF EXISTS "offer_signature_submissions_decision_shape_chk";
ALTER TABLE "dsp_pms"."offer_signature_submissions"
  ADD CONSTRAINT "offer_signature_submissions_decision_shape_chk" CHECK (
    ("status" <> 'VERIFIED' OR ("verifiedByUserId" IS NOT NULL AND "verifiedAt" IS NOT NULL))
    AND ("status" <> 'REJECTED' OR ("rejectedByUserId" IS NOT NULL AND "rejectedAt" IS NOT NULL AND "rejectionReason" IS NOT NULL))
    AND ("status" <> 'SUPERSEDED' OR "supersededBySubmissionId" IS NOT NULL)
  ) NOT VALID;

-- ─── Triggers: same-tenant CLEAN FileObject links ────────────────────────────

CREATE OR REPLACE FUNCTION "dsp_pms".file_object_link_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  obj RECORD;
BEGIN
  IF NEW."fileObjectId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "companyId", "status"
    INTO obj
  FROM "dsp_pms"."file_objects"
  WHERE "id" = NEW."fileObjectId";

  IF obj IS NULL THEN
    RAISE EXCEPTION 'FILE_NOT_FOUND';
  END IF;

  IF NEW."companyId" IS NOT NULL AND obj."companyId" <> NEW."companyId" THEN
    RAISE EXCEPTION 'UPLOAD_SCOPE_MISMATCH';
  END IF;

  IF obj."status" <> 'CLEAN' THEN
    RAISE EXCEPTION 'FILE_NOT_CLEAN';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recruitment_documents_file_object_guard ON "dsp_pms"."recruitment_documents";
CREATE TRIGGER recruitment_documents_file_object_guard
  BEFORE INSERT OR UPDATE OF "fileObjectId", "companyId"
  ON "dsp_pms"."recruitment_documents"
  FOR EACH ROW
  EXECUTE FUNCTION "dsp_pms".file_object_link_guard();

DROP TRIGGER IF EXISTS employee_documents_file_object_guard ON "dsp_pms"."employee_documents";
CREATE TRIGGER employee_documents_file_object_guard
  BEFORE INSERT OR UPDATE OF "fileObjectId", "companyId"
  ON "dsp_pms"."employee_documents"
  FOR EACH ROW
  EXECUTE FUNCTION "dsp_pms".file_object_link_guard();

CREATE OR REPLACE FUNCTION "dsp_pms".verified_signature_clean_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  obj_status "dsp_pms"."FileObjectStatus";
BEGIN
  IF NEW."status" <> 'VERIFIED' THEN
    RETURN NEW;
  END IF;

  SELECT "status" INTO obj_status
  FROM "dsp_pms"."file_objects"
  WHERE "id" = NEW."fileObjectId";

  IF obj_status IS DISTINCT FROM 'CLEAN' THEN
    RAISE EXCEPTION 'FILE_NOT_CLEAN';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS offer_signature_verified_clean_guard ON "dsp_pms"."offer_signature_submissions";
CREATE TRIGGER offer_signature_verified_clean_guard
  BEFORE INSERT OR UPDATE OF "status", "fileObjectId"
  ON "dsp_pms"."offer_signature_submissions"
  FOR EACH ROW
  EXECUTE FUNCTION "dsp_pms".verified_signature_clean_guard();

CREATE OR REPLACE FUNCTION "dsp_pms".file_object_delete_reference_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rec_count integer;
  emp_count integer;
  sig_count integer;
BEGIN
  IF NEW."status" NOT IN ('DELETION_PENDING', 'DELETED') THEN
    RETURN NEW;
  END IF;

  IF NEW."legalHoldAt" IS NOT NULL THEN
    RAISE EXCEPTION 'FILE_LEGAL_HOLD';
  END IF;

  SELECT count(*) INTO rec_count
  FROM "dsp_pms"."recruitment_documents"
  WHERE "fileObjectId" = NEW."id";

  SELECT count(*) INTO emp_count
  FROM "dsp_pms"."employee_documents"
  WHERE "fileObjectId" = NEW."id";

  SELECT count(*) INTO sig_count
  FROM "dsp_pms"."offer_signature_submissions"
  WHERE "fileObjectId" = NEW."id";

  IF rec_count > 0 OR emp_count > 0 OR sig_count > 0 THEN
    RAISE EXCEPTION 'FILE_STILL_REFERENCED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS file_objects_delete_reference_guard ON "dsp_pms"."file_objects";
CREATE TRIGGER file_objects_delete_reference_guard
  BEFORE UPDATE OF "status"
  ON "dsp_pms"."file_objects"
  FOR EACH ROW
  EXECUTE FUNCTION "dsp_pms".file_object_delete_reference_guard();
