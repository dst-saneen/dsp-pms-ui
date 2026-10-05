-- Gate P0.2 / Step 1
-- Additive expansion for the canonical Delivery contract.
-- Do not remove legacy columns or enum values in this migration.
-- IDs in this schema are TEXT (not UUID).

-- ---------------------------------------------------------------------------
-- Enum expansion
-- ---------------------------------------------------------------------------

ALTER TYPE "DeliveryRecipientKind" ADD VALUE IF NOT EXISTS 'EXTERNAL_EMAIL';
ALTER TYPE "DeliveryRecipientKind" ADD VALUE IF NOT EXISTS 'USER';

ALTER TYPE "DeliveryProvider" ADD VALUE IF NOT EXISTS 'INTERNAL';

ALTER TYPE "DeliveryMessageStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "DeliveryMessageStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "DeliveryMessageStatus" ADD VALUE IF NOT EXISTS 'RETRY_WAIT';
ALTER TYPE "DeliveryMessageStatus" ADD VALUE IF NOT EXISTS 'RECONCILING';
ALTER TYPE "DeliveryMessageStatus" ADD VALUE IF NOT EXISTS 'BOUNCED_SOFT';
ALTER TYPE "DeliveryMessageStatus" ADD VALUE IF NOT EXISTS 'BOUNCED_HARD';
ALTER TYPE "DeliveryMessageStatus" ADD VALUE IF NOT EXISTS 'COMPLAINED';

ALTER TYPE "DeliveryAttemptOutcome" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "DeliveryAttemptOutcome" ADD VALUE IF NOT EXISTS 'TRANSIENT_FAILURE';
ALTER TYPE "DeliveryAttemptOutcome" ADD VALUE IF NOT EXISTS 'PERMANENT_FAILURE';
ALTER TYPE "DeliveryAttemptOutcome" ADD VALUE IF NOT EXISTS 'AMBIGUOUS';
ALTER TYPE "DeliveryAttemptOutcome" ADD VALUE IF NOT EXISTS 'BYPASSED';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION dsp_pms_tmp_add_fk(
  p_table TEXT,
  p_constraint TEXT,
  p_sql TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = p_constraint
  ) THEN
    EXECUTE p_sql;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- delivery_messages
-- ---------------------------------------------------------------------------

ALTER TABLE "delivery_messages"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "aggregateType" TEXT,
  ADD COLUMN IF NOT EXISTS "aggregateId" TEXT,
  ADD COLUMN IF NOT EXISTS "eventType" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientEmployeeId" TEXT,
  ADD COLUMN IF NOT EXISTS "queuedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "terminalAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "deadLetteredAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lockedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lockExpiresAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "templateKey" TEXT,
  ADD COLUMN IF NOT EXISTS "templateVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientAddressCiphertext" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientAddressNonce" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientAddressAuthTag" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientAddressKeyVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientAddressHmac" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientAddressHmacKeyVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "subjectCiphertext" TEXT,
  ADD COLUMN IF NOT EXISTS "bodyTextCiphertext" TEXT,
  ADD COLUMN IF NOT EXISTS "bodyHtmlCiphertext" TEXT,
  ADD COLUMN IF NOT EXISTS "contentNonce" TEXT,
  ADD COLUMN IF NOT EXISTS "contentAuthTag" TEXT,
  ADD COLUMN IF NOT EXISTS "contentKeyVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "providerRequestId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerEmailReference" TEXT,
  ADD COLUMN IF NOT EXISTS "lastErrorClass" TEXT;

-- Repair a partial failed apply that may have created UUID columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'delivery_messages'
      AND column_name = 'recipientUserId'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE "delivery_messages"
      ALTER COLUMN "recipientUserId" TYPE TEXT USING "recipientUserId"::TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'delivery_messages'
      AND column_name = 'recipientEmployeeId'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE "delivery_messages"
      ALTER COLUMN "recipientEmployeeId" TYPE TEXT USING "recipientEmployeeId"::TEXT;
  END IF;
END $$;

SELECT dsp_pms_tmp_add_fk(
  'delivery_messages',
  'delivery_messages_companyId_fkey',
  'ALTER TABLE "delivery_messages" ADD CONSTRAINT "delivery_messages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'delivery_messages',
  'delivery_messages_branchId_fkey',
  'ALTER TABLE "delivery_messages" ADD CONSTRAINT "delivery_messages_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'delivery_messages',
  'delivery_messages_companyGroupId_fkey',
  'ALTER TABLE "delivery_messages" ADD CONSTRAINT "delivery_messages_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "company_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'delivery_messages',
  'delivery_messages_outboxEventId_fkey',
  'ALTER TABLE "delivery_messages" ADD CONSTRAINT "delivery_messages_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "outbox_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'delivery_messages',
  'delivery_messages_recipientUserId_fkey',
  'ALTER TABLE "delivery_messages" ADD CONSTRAINT "delivery_messages_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'delivery_messages',
  'delivery_messages_recipientEmployeeId_fkey',
  'ALTER TABLE "delivery_messages" ADD CONSTRAINT "delivery_messages_recipientEmployeeId_fkey" FOREIGN KEY ("recipientEmployeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

CREATE INDEX IF NOT EXISTS "delivery_messages_status_nextAttemptAt_idx"
  ON "delivery_messages"("status", "nextAttemptAt");

CREATE INDEX IF NOT EXISTS "delivery_messages_status_lockExpiresAt_idx"
  ON "delivery_messages"("status", "lockExpiresAt");

CREATE INDEX IF NOT EXISTS "delivery_messages_companyId_branchId_createdAt_idx"
  ON "delivery_messages"("companyId", "branchId", "createdAt");

CREATE INDEX IF NOT EXISTS "delivery_messages_aggregateType_aggregateId_createdAt_idx"
  ON "delivery_messages"("aggregateType", "aggregateId", "createdAt");

CREATE INDEX IF NOT EXISTS "delivery_messages_recipientUserId_createdAt_idx"
  ON "delivery_messages"("recipientUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "delivery_messages_eventType_status_createdAt_idx"
  ON "delivery_messages"("eventType", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "delivery_messages_providerEmailReference_idx"
  ON "delivery_messages"("providerEmailReference");

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_messages_clientReference_key"
  ON "delivery_messages"("clientReference");

-- ---------------------------------------------------------------------------
-- delivery_attempts
-- ---------------------------------------------------------------------------

ALTER TABLE "delivery_attempts"
  ADD COLUMN IF NOT EXISTS "provider" "DeliveryProvider" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "providerEmailReference" TEXT,
  ADD COLUMN IF NOT EXISTS "clientReference" TEXT,
  ADD COLUMN IF NOT EXISTS "errorClass" TEXT,
  ADD COLUMN IF NOT EXISTS "workerCorrelationId" TEXT,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_attempts_deliveryMessageId_attemptNo_key"
  ON "delivery_attempts"("deliveryMessageId", "attemptNo");

-- ---------------------------------------------------------------------------
-- delivery_provider_events
-- ---------------------------------------------------------------------------

ALTER TABLE "delivery_provider_events"
  ADD COLUMN IF NOT EXISTS "normalizedEventType" TEXT,
  ADD COLUMN IF NOT EXISTS "providerEmailReference" TEXT,
  ADD COLUMN IF NOT EXISTS "canonicalPayloadDigest" TEXT,
  ADD COLUMN IF NOT EXISTS "canonicalPayloadHashVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureTimestamp" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "signatureAlgorithm" TEXT,
  ADD COLUMN IF NOT EXISTS "encryptedPayload" TEXT,
  ADD COLUMN IF NOT EXISTS "payloadNonce" TEXT,
  ADD COLUMN IF NOT EXISTS "payloadAuthTag" TEXT,
  ADD COLUMN IF NOT EXISTS "payloadKeyVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "processingErrorCode" TEXT;

CREATE INDEX IF NOT EXISTS "delivery_provider_events_providerEmailReference_idx"
  ON "delivery_provider_events"("providerEmailReference");

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_provider_events_provider_providerEventId_key"
  ON "delivery_provider_events"("provider", "providerEventId")
  WHERE "providerEventId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_provider_events_provider_canonicalPayloadDigest_key"
  ON "delivery_provider_events"("provider", "canonicalPayloadDigest")
  WHERE "providerEventId" IS NULL AND "canonicalPayloadDigest" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- email_suppressions
-- ---------------------------------------------------------------------------

ALTER TABLE "email_suppressions"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "addressHmacKeyVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceDeliveryMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceProviderEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "suppressedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "releasedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "releaseReason" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'email_suppressions'
      AND column_name = 'companyId'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE "email_suppressions"
      ALTER COLUMN "companyId" TYPE TEXT USING "companyId"::TEXT;
  END IF;
END $$;

SELECT dsp_pms_tmp_add_fk(
  'email_suppressions',
  'email_suppressions_companyId_fkey',
  'ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'email_suppressions',
  'email_suppressions_sourceDeliveryMessageId_fkey',
  'ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_sourceDeliveryMessageId_fkey" FOREIGN KEY ("sourceDeliveryMessageId") REFERENCES "delivery_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'email_suppressions',
  'email_suppressions_sourceProviderEventId_fkey',
  'ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_sourceProviderEventId_fkey" FOREIGN KEY ("sourceProviderEventId") REFERENCES "delivery_provider_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'email_suppressions',
  'email_suppressions_suppressedByUserId_fkey',
  'ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_suppressedByUserId_fkey" FOREIGN KEY ("suppressedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'email_suppressions',
  'email_suppressions_releasedByUserId_fkey',
  'ALTER TABLE "email_suppressions" ADD CONSTRAINT "email_suppressions_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

CREATE INDEX IF NOT EXISTS "email_suppressions_companyId_addressHmac_idx"
  ON "email_suppressions"("companyId", "addressHmac");

CREATE UNIQUE INDEX IF NOT EXISTS "email_suppressions_companyId_addressHmac_active_key"
  ON "email_suppressions"("companyId", "addressHmac")
  WHERE "releasedAt" IS NULL AND "companyId" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- delivery_command_receipts
-- ---------------------------------------------------------------------------

ALTER TABLE "delivery_command_receipts"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "commandType" TEXT,
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "requestHash" TEXT,
  ADD COLUMN IF NOT EXISTS "requestHashKeyVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "requestHashFormatVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "responseSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'delivery_command_receipts'
      AND column_name = 'companyId'
      AND data_type = 'uuid'
  ) THEN
    ALTER TABLE "delivery_command_receipts"
      ALTER COLUMN "companyId" TYPE TEXT USING "companyId"::TEXT;
  END IF;
END $$;

SELECT dsp_pms_tmp_add_fk(
  'delivery_command_receipts',
  'delivery_command_receipts_companyId_fkey',
  'ALTER TABLE "delivery_command_receipts" ADD CONSTRAINT "delivery_command_receipts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'delivery_command_receipts',
  'delivery_command_receipts_deliveryMessageId_fkey',
  'ALTER TABLE "delivery_command_receipts" ADD CONSTRAINT "delivery_command_receipts_deliveryMessageId_fkey" FOREIGN KEY ("deliveryMessageId") REFERENCES "delivery_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'delivery_command_receipts',
  'delivery_command_receipts_suppressionId_fkey',
  'ALTER TABLE "delivery_command_receipts" ADD CONSTRAINT "delivery_command_receipts_suppressionId_fkey" FOREIGN KEY ("suppressionId") REFERENCES "email_suppressions"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

SELECT dsp_pms_tmp_add_fk(
  'delivery_command_receipts',
  'delivery_command_receipts_actorUserId_fkey',
  'ALTER TABLE "delivery_command_receipts" ADD CONSTRAINT "delivery_command_receipts_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE'
);

CREATE UNIQUE INDEX IF NOT EXISTS "delivery_command_receipts_companyId_operationId_key"
  ON "delivery_command_receipts"("companyId", "operationId");

-- ---------------------------------------------------------------------------
-- Safety checks compatible with legacy + canonical rows
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_messages_attemptCount_nonnegative_chk'
  ) THEN
    ALTER TABLE "delivery_messages"
      ADD CONSTRAINT "delivery_messages_attemptCount_nonnegative_chk"
      CHECK ("attemptCount" >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_attempts_attemptNo_positive_chk'
  ) THEN
    ALTER TABLE "delivery_attempts"
      ADD CONSTRAINT "delivery_attempts_attemptNo_positive_chk"
      CHECK ("attemptNo" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_attempts_completedAt_after_startedAt_chk'
  ) THEN
    ALTER TABLE "delivery_attempts"
      ADD CONSTRAINT "delivery_attempts_completedAt_after_startedAt_chk"
      CHECK ("completedAt" IS NULL OR "completedAt" >= "startedAt");
  END IF;
END $$;

DROP FUNCTION IF EXISTS dsp_pms_tmp_add_fk(TEXT, TEXT, TEXT);
