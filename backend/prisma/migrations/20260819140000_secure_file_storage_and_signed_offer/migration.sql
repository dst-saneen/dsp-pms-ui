-- Migration: Secure File Storage and Signed Offer
-- Adds: FileObjectStatus, FileUploadSessionStatus, FileOperationType, FileOperationStatus,
--       FileRetentionClass, OfferSignatureSubmissionStatus, FileUploadPurpose enums
-- Adds: file_objects, file_upload_sessions, file_operation_attempts,
--       file_access_audits, file_retention_policies, offer_signature_submissions tables
-- Expands: recruitment_documents, employee_documents with fileObjectId, companyId, branchId, version

-- ─── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "dsp_pms"."FileObjectStatus" AS ENUM (
    'QUARANTINED','SCANNING','CLEAN','INFECTED','SCAN_FAILED',
    'UNREFERENCED','DELETION_PENDING','DELETED','MISSING'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "dsp_pms"."FileUploadSessionStatus" AS ENUM (
    'ISSUED','UPLOADED','FINALIZING','CLEAN','REJECTED','EXPIRED','CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "dsp_pms"."FileOperationType" AS ENUM (
    'VERIFY_UPLOAD','SCAN','PROMOTE','DELETE','RECONCILE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "dsp_pms"."FileOperationStatus" AS ENUM (
    'PENDING','PROCESSING','SUCCEEDED','RETRY_WAIT','DEAD_LETTER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "dsp_pms"."FileRetentionClass" AS ENUM (
    'PUBLIC_UPLOAD_ORPHAN','RECRUITMENT_UNSUCCESSFUL','RECRUITMENT_HIRED',
    'EMPLOYEE_RECORD','INFECTED_OR_FAILED_SCAN'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "dsp_pms"."OfferSignatureSubmissionStatus" AS ENUM (
    'PENDING_VERIFICATION','VERIFIED','REJECTED','SUPERSEDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "dsp_pms"."FileUploadPurpose" AS ENUM (
    'CV','SUPPORTING','EMPLOYEE_DOCUMENT','SIGNED_OFFER','GENERATED_OFFER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── file_objects ────────────────────────────────────────────────────────────

CREATE TABLE "dsp_pms"."file_objects" (
  "id"                          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "version"                     INTEGER NOT NULL DEFAULT 0,
  "companyId"                   TEXT NOT NULL,
  "branchId"                    TEXT,
  "storageProfileCode"          TEXT NOT NULL,
  "objectKey"                   TEXT NOT NULL,
  "providerObjectRef"           TEXT,
  "status"                      "dsp_pms"."FileObjectStatus" NOT NULL DEFAULT 'QUARANTINED',
  "originalFileNameEncrypted"   TEXT NOT NULL,
  "fileNameEncKeyVersion"       TEXT NOT NULL,
  "safeExtension"               TEXT NOT NULL,
  "declaredMimeType"            TEXT NOT NULL,
  "detectedMimeType"            TEXT,
  "expectedSizeBytes"           INTEGER NOT NULL,
  "actualSizeBytes"             INTEGER,
  "expectedChecksumSha256"      TEXT NOT NULL,
  "actualChecksumSha256"        TEXT,
  "clamAvEngineVersion"         TEXT,
  "clamAvSignatureVersion"      TEXT,
  "clamAvResult"                TEXT,
  "scannedAt"                   TIMESTAMP(3),
  "sseMode"                     TEXT,
  "sseKeyRef"                   TEXT,
  "retentionClass"              "dsp_pms"."FileRetentionClass",
  "retainUntil"                 TIMESTAMP(3),
  "legalHoldActorId"            TEXT,
  "legalHoldAt"                 TIMESTAMP(3),
  "legalHoldReason"             TEXT,
  "deletionRequestActorId"      TEXT,
  "deletionRequestedAt"         TIMESTAMP(3),
  "deletionRequestReason"       TEXT,
  "deletionCompletedAt"         TIMESTAMP(3),
  "creatorUserId"               TEXT,
  "publicUploadContext"         TEXT,
  "createdAt"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "file_objects_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_objects_companyId_id_key" ON "dsp_pms"."file_objects"("companyId", "id");
CREATE UNIQUE INDEX "file_objects_storageProfileCode_objectKey_key" ON "dsp_pms"."file_objects"("storageProfileCode", "objectKey");
CREATE INDEX "file_objects_status_updatedAt_idx" ON "dsp_pms"."file_objects"("status", "updatedAt");
CREATE INDEX "file_objects_companyId_branchId_status_createdAt_idx" ON "dsp_pms"."file_objects"("companyId", "branchId", "status", "createdAt");
CREATE INDEX "file_objects_retainUntil_status_idx" ON "dsp_pms"."file_objects"("retainUntil", "status");
CREATE INDEX "file_objects_actualChecksumSha256_idx" ON "dsp_pms"."file_objects"("actualChecksumSha256");

ALTER TABLE "dsp_pms"."file_objects"
  ADD CONSTRAINT "file_objects_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "dsp_pms"."companies"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "dsp_pms"."file_objects"
  ADD CONSTRAINT "file_objects_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "dsp_pms"."branches"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "dsp_pms"."file_objects"
  ADD CONSTRAINT "file_objects_creatorUserId_fkey"
  FOREIGN KEY ("creatorUserId") REFERENCES "dsp_pms"."users"("id")
  ON DELETE SET NULL ON UPDATE RESTRICT;

-- ─── file_upload_sessions ────────────────────────────────────────────────────

CREATE TABLE "dsp_pms"."file_upload_sessions" (
  "id"                      TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "version"                 INTEGER NOT NULL DEFAULT 0,
  "companyId"               TEXT NOT NULL,
  "branchId"                TEXT,
  "purpose"                 "dsp_pms"."FileUploadPurpose" NOT NULL,
  "jobOpeningId"            TEXT,
  "jobApplicationId"        TEXT,
  "employeeId"              TEXT,
  "jobOfferId"              TEXT,
  "applicationOperationId"  TEXT,
  "expectedFileName"        TEXT NOT NULL,
  "safeExtension"           TEXT NOT NULL,
  "declaredMimeType"        TEXT NOT NULL,
  "expectedSizeBytes"       INTEGER NOT NULL,
  "expectedChecksumSha256"  TEXT NOT NULL,
  "quarantineObjectKey"     TEXT NOT NULL,
  "publicSessionTokenHash"  TEXT,
  "status"                  "dsp_pms"."FileUploadSessionStatus" NOT NULL DEFAULT 'ISSUED',
  "expiresAt"               TIMESTAMP(3) NOT NULL,
  "uploadedAt"              TIMESTAMP(3),
  "finalizedAt"             TIMESTAMP(3),
  "fileObjectId"            TEXT,
  "operationId"             TEXT NOT NULL,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,

  CONSTRAINT "file_upload_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_upload_sessions_companyId_operationId_key" ON "dsp_pms"."file_upload_sessions"("companyId", "operationId");
CREATE INDEX "file_upload_sessions_status_expiresAt_idx" ON "dsp_pms"."file_upload_sessions"("status", "expiresAt");
CREATE INDEX "file_upload_sessions_companyId_branchId_status_createdAt_idx" ON "dsp_pms"."file_upload_sessions"("companyId", "branchId", "status", "createdAt");
CREATE INDEX "file_upload_sessions_jobOpeningId_applicationOperationId_idx" ON "dsp_pms"."file_upload_sessions"("jobOpeningId", "applicationOperationId");
CREATE INDEX "file_upload_sessions_jobOfferId_status_idx" ON "dsp_pms"."file_upload_sessions"("jobOfferId", "status");

ALTER TABLE "dsp_pms"."file_upload_sessions"
  ADD CONSTRAINT "file_upload_sessions_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "dsp_pms"."companies"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "dsp_pms"."file_upload_sessions"
  ADD CONSTRAINT "file_upload_sessions_fileObjectId_fkey"
  FOREIGN KEY ("fileObjectId") REFERENCES "dsp_pms"."file_objects"("id")
  ON DELETE SET NULL;

-- ─── file_operation_attempts ─────────────────────────────────────────────────

CREATE TABLE "dsp_pms"."file_operation_attempts" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "fileObjectId"          TEXT,
  "uploadSessionId"       TEXT,
  "operationType"         "dsp_pms"."FileOperationType" NOT NULL,
  "attemptNo"             INTEGER NOT NULL DEFAULT 1,
  "status"                "dsp_pms"."FileOperationStatus" NOT NULL DEFAULT 'PENDING',
  "safeErrorClass"        TEXT,
  "safeErrorCode"         TEXT,
  "workerCorrelationId"   TEXT,
  "startedAt"             TIMESTAMP(3),
  "completedAt"           TIMESTAMP(3),
  "nextAttemptAt"         TIMESTAMP(3),
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "file_operation_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_operation_attempts_fileObjectId_operationType_attemptNo_key"
  ON "dsp_pms"."file_operation_attempts"("fileObjectId", "operationType", "attemptNo")
  WHERE "fileObjectId" IS NOT NULL;

CREATE INDEX "file_operation_attempts_status_nextAttemptAt_idx" ON "dsp_pms"."file_operation_attempts"("status", "nextAttemptAt");

ALTER TABLE "dsp_pms"."file_operation_attempts"
  ADD CONSTRAINT "file_operation_attempts_fileObjectId_fkey"
  FOREIGN KEY ("fileObjectId") REFERENCES "dsp_pms"."file_objects"("id")
  ON DELETE RESTRICT;

-- ─── file_access_audits ──────────────────────────────────────────────────────

CREATE TABLE "dsp_pms"."file_access_audits" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "fileObjectId"          TEXT NOT NULL,
  "documentType"          TEXT,
  "documentId"            TEXT,
  "companyId"             TEXT NOT NULL,
  "branchId"              TEXT,
  "actorUserId"           TEXT,
  "actorEmployeeId"       TEXT,
  "publicOfferContext"    TEXT,
  "accessPurpose"         TEXT NOT NULL,
  "decision"              TEXT NOT NULL,
  "denialCode"            TEXT,
  "requestId"             TEXT,
  "correlationId"         TEXT,
  "accessedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "file_access_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "file_access_audits_fileObjectId_accessedAt_idx" ON "dsp_pms"."file_access_audits"("fileObjectId", "accessedAt");
CREATE INDEX "file_access_audits_companyId_branchId_accessedAt_idx" ON "dsp_pms"."file_access_audits"("companyId", "branchId", "accessedAt");

ALTER TABLE "dsp_pms"."file_access_audits"
  ADD CONSTRAINT "file_access_audits_fileObjectId_fkey"
  FOREIGN KEY ("fileObjectId") REFERENCES "dsp_pms"."file_objects"("id")
  ON DELETE RESTRICT;

-- ─── file_retention_policies ─────────────────────────────────────────────────

CREATE TABLE "dsp_pms"."file_retention_policies" (
  "id"                    TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId"             TEXT NOT NULL,
  "retentionClass"        "dsp_pms"."FileRetentionClass" NOT NULL,
  "retentionRule"         TEXT NOT NULL,
  "retentionValue"        INTEGER NOT NULL,
  "enabled"               BOOLEAN NOT NULL DEFAULT false,
  "version"               INTEGER NOT NULL DEFAULT 0,
  "approvedByUserId"      TEXT,
  "approvedAt"            TIMESTAMP(3),
  "lastUpdatedByUserId"   TEXT,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "file_retention_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_retention_policies_companyId_retentionClass_key" ON "dsp_pms"."file_retention_policies"("companyId", "retentionClass");

ALTER TABLE "dsp_pms"."file_retention_policies"
  ADD CONSTRAINT "file_retention_policies_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "dsp_pms"."companies"("id")
  ON DELETE RESTRICT;

-- ─── Expand recruitment_documents ────────────────────────────────────────────

ALTER TABLE "dsp_pms"."recruitment_documents"
  ADD COLUMN IF NOT EXISTS "companyId"    TEXT,
  ADD COLUMN IF NOT EXISTS "branchId"     TEXT,
  ADD COLUMN IF NOT EXISTS "version"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fileObjectId" TEXT;

CREATE INDEX "recruitment_documents_companyId_branchId_idx" ON "dsp_pms"."recruitment_documents"("companyId", "branchId");
CREATE INDEX "recruitment_documents_fileObjectId_idx" ON "dsp_pms"."recruitment_documents"("fileObjectId");

ALTER TABLE "dsp_pms"."recruitment_documents"
  ADD CONSTRAINT "recruitment_documents_fileObjectId_fkey"
  FOREIGN KEY ("fileObjectId") REFERENCES "dsp_pms"."file_objects"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ─── Expand employee_documents ───────────────────────────────────────────────

ALTER TABLE "dsp_pms"."employee_documents"
  ADD COLUMN IF NOT EXISTS "companyId"        TEXT,
  ADD COLUMN IF NOT EXISTS "branchIdAtUpload" TEXT,
  ADD COLUMN IF NOT EXISTS "version"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "fileObjectId"     TEXT;

CREATE INDEX "employee_documents_companyId_branchIdAtUpload_idx" ON "dsp_pms"."employee_documents"("companyId", "branchIdAtUpload");
CREATE INDEX "employee_documents_fileObjectId_idx" ON "dsp_pms"."employee_documents"("fileObjectId");

ALTER TABLE "dsp_pms"."employee_documents"
  ADD CONSTRAINT "employee_documents_fileObjectId_fkey"
  FOREIGN KEY ("fileObjectId") REFERENCES "dsp_pms"."file_objects"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ─── offer_signature_submissions ─────────────────────────────────────────────

CREATE TABLE "dsp_pms"."offer_signature_submissions" (
  "id"                        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "companyId"                 TEXT NOT NULL,
  "branchId"                  TEXT,
  "jobOfferId"                TEXT NOT NULL,
  "jobApplicationId"          TEXT NOT NULL,
  "submissionNo"              INTEGER NOT NULL DEFAULT 1,
  "recruitmentDocumentId"     TEXT NOT NULL,
  "fileObjectId"              TEXT NOT NULL,
  "candidateLegalName"        TEXT NOT NULL,
  "declarationAcceptedAt"     TIMESTAMP(3) NOT NULL,
  "status"                    "dsp_pms"."OfferSignatureSubmissionStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "version"                   INTEGER NOT NULL DEFAULT 0,
  "submittedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedByUserId"          TEXT,
  "verifiedAt"                TIMESTAMP(3),
  "verificationNote"          TEXT,
  "rejectedByUserId"          TEXT,
  "rejectedAt"                TIMESTAMP(3),
  "rejectionReason"           TEXT,
  "supersededBySubmissionId"  TEXT,
  "requestId"                 TEXT,
  "correlationId"             TEXT,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMP(3) NOT NULL,

  CONSTRAINT "offer_signature_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "offer_signature_submissions_jobOfferId_submissionNo_key" ON "dsp_pms"."offer_signature_submissions"("jobOfferId", "submissionNo");
CREATE INDEX "offer_signature_submissions_jobOfferId_status_idx" ON "dsp_pms"."offer_signature_submissions"("jobOfferId", "status");
CREATE INDEX "offer_signature_submissions_jobApplicationId_status_idx" ON "dsp_pms"."offer_signature_submissions"("jobApplicationId", "status");

-- Partial unique: only one PENDING_VERIFICATION per Offer
CREATE UNIQUE INDEX "offer_signature_submissions_jobOfferId_pending_idx"
  ON "dsp_pms"."offer_signature_submissions"("jobOfferId")
  WHERE "status" = 'PENDING_VERIFICATION';

-- Partial unique: only one VERIFIED per Offer
CREATE UNIQUE INDEX "offer_signature_submissions_jobOfferId_verified_idx"
  ON "dsp_pms"."offer_signature_submissions"("jobOfferId")
  WHERE "status" = 'VERIFIED';

ALTER TABLE "dsp_pms"."offer_signature_submissions"
  ADD CONSTRAINT "offer_signature_submissions_jobOfferId_fkey"
  FOREIGN KEY ("jobOfferId") REFERENCES "dsp_pms"."job_offers"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "dsp_pms"."offer_signature_submissions"
  ADD CONSTRAINT "offer_signature_submissions_jobApplicationId_fkey"
  FOREIGN KEY ("jobApplicationId") REFERENCES "dsp_pms"."job_applications"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "dsp_pms"."offer_signature_submissions"
  ADD CONSTRAINT "offer_signature_submissions_recruitmentDocumentId_fkey"
  FOREIGN KEY ("recruitmentDocumentId") REFERENCES "dsp_pms"."recruitment_documents"("id")
  ON DELETE RESTRICT;

ALTER TABLE "dsp_pms"."offer_signature_submissions"
  ADD CONSTRAINT "offer_signature_submissions_fileObjectId_fkey"
  FOREIGN KEY ("fileObjectId") REFERENCES "dsp_pms"."file_objects"("id")
  ON DELETE RESTRICT;
