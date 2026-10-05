-- ============================================================
-- Phase E: Durable Delivery V2 Foundation
-- ============================================================
-- New enums
-- ============================================================

CREATE TYPE "DeliveryChannel" AS ENUM ('EMAIL', 'IN_APP');

CREATE TYPE "DeliveryRecipientKind" AS ENUM (
  'CANDIDATE',
  'EMPLOYEE',
  'HR',
  'PANEL_MEMBER',
  'SYSTEM'
);

CREATE TYPE "DeliveryProvider" AS ENUM ('ZEPTOMAIL', 'IN_APP_STORE', 'NONE');

CREATE TYPE "DeliveryMessageStatus" AS ENUM (
  'QUEUED',
  'SENDING',
  'DELIVERED',
  'FAILED',
  'DEAD_LETTER',
  'BYPASSED',
  'CANCELLED'
);

CREATE TYPE "DeliveryAttemptOutcome" AS ENUM (
  'ACCEPTED',
  'REJECTED_PERMANENT',
  'REJECTED_TRANSIENT',
  'TIMEOUT',
  'NETWORK_ERROR'
);

-- ============================================================
-- delivery_messages
-- One row per (recipient × channel) for each logical delivery.
-- ============================================================

CREATE TABLE "delivery_messages" (
  "id"               TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,

  -- Tenant scoping
  "companyGroupId"   TEXT,
  "companyId"        TEXT,
  "branchId"         TEXT,

  -- Source tracing
  "outboxEventId"    TEXT,
  "outboxEventType"  TEXT        NOT NULL,
  "dedupeKey"        TEXT        NOT NULL,

  -- Recipient
  "recipientKind"    "DeliveryRecipientKind" NOT NULL,
  "recipientId"      TEXT        NOT NULL,   -- userId / candidateId / employeeId

  -- Channel + provider
  "channel"          "DeliveryChannel" NOT NULL,
  "provider"         "DeliveryProvider" NOT NULL DEFAULT 'NONE',

  -- Status machine
  "status"           "DeliveryMessageStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptCount"     INTEGER     NOT NULL DEFAULT 0,
  "nextAttemptAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "firstAttemptAt"   TIMESTAMPTZ,
  "lastAttemptAt"    TIMESTAMPTZ,
  "deliveredAt"      TIMESTAMPTZ,

  -- Email-specific (only set when channel = EMAIL)
  "toAddress"        TEXT,           -- stored in plain text; HMAC in suppressions
  "toDisplayName"    TEXT,
  "subject"          TEXT,
  -- body is NOT stored here (security + size); regenerated on retry

  -- Provider reference (set after first accepted send)
  "clientReference"  TEXT,
  "providerMessageId" TEXT,

  -- Dead-letter / suppression metadata
  "lastErrorCode"    TEXT,
  "bypassReason"     TEXT,

  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "delivery_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_messages_dedupeKey_key"
  ON "delivery_messages" ("dedupeKey");

CREATE INDEX "delivery_messages_status_channel_nextAttemptAt_idx"
  ON "delivery_messages" ("status", "channel", "nextAttemptAt")
  WHERE "status" IN ('QUEUED', 'SENDING');

CREATE INDEX "delivery_messages_outboxEventId_idx"
  ON "delivery_messages" ("outboxEventId")
  WHERE "outboxEventId" IS NOT NULL;

CREATE INDEX "delivery_messages_clientReference_idx"
  ON "delivery_messages" ("clientReference")
  WHERE "clientReference" IS NOT NULL;

CREATE INDEX "delivery_messages_recipientId_idx"
  ON "delivery_messages" ("recipientId", "channel", "status");

-- ============================================================
-- delivery_attempts
-- One row per actual HTTP/store call against a provider.
-- ============================================================

CREATE TABLE "delivery_attempts" (
  "id"               TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "deliveryMessageId" TEXT       NOT NULL,

  "attemptNo"        INTEGER     NOT NULL,
  "outcome"          "DeliveryAttemptOutcome" NOT NULL,

  "providerRequestId"  TEXT,
  "providerStatusCode" INTEGER,
  "errorCode"          TEXT,

  "attemptedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "durationMs"       INTEGER,

  CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_attempts_deliveryMessageId_fkey"
    FOREIGN KEY ("deliveryMessageId")
    REFERENCES "delivery_messages" ("id")
    ON DELETE CASCADE
);

CREATE INDEX "delivery_attempts_deliveryMessageId_idx"
  ON "delivery_attempts" ("deliveryMessageId");

-- ============================================================
-- delivery_provider_events
-- Raw webhook events from the provider, keyed by clientReference.
-- ============================================================

CREATE TABLE "delivery_provider_events" (
  "id"               TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "deliveryMessageId" TEXT,        -- nullable until correlated

  "provider"         "DeliveryProvider" NOT NULL,
  "eventType"        TEXT        NOT NULL,   -- delivered, hard_bounce, etc.
  "clientReference"  TEXT,

  "providerEventId"  TEXT,
  "rawPayload"       JSONB       NOT NULL,

  "receivedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "processedAt"      TIMESTAMPTZ,

  CONSTRAINT "delivery_provider_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_provider_events_deliveryMessageId_fkey"
    FOREIGN KEY ("deliveryMessageId")
    REFERENCES "delivery_messages" ("id")
    ON DELETE SET NULL
);

CREATE INDEX "delivery_provider_events_clientReference_idx"
  ON "delivery_provider_events" ("clientReference")
  WHERE "clientReference" IS NOT NULL;

CREATE INDEX "delivery_provider_events_deliveryMessageId_idx"
  ON "delivery_provider_events" ("deliveryMessageId")
  WHERE "deliveryMessageId" IS NOT NULL;

-- ============================================================
-- email_suppressions
-- Hard-bounced / complained addresses that must not be emailed.
-- Address is stored only as HMAC-SHA256(normalised_address, secret).
-- ============================================================

CREATE TABLE "email_suppressions" (
  "id"               TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,

  "companyGroupId"   TEXT,

  -- HMAC-SHA256(lower(trim(address)), EMAIL_SUPPRESSION_KEY) — never raw email
  "addressHmac"      TEXT        NOT NULL,

  "reason"           TEXT        NOT NULL,   -- HARD_BOUNCE | COMPLAINT | MANUAL
  "sourceEventId"    TEXT,                   -- delivery_provider_events.id

  "suppressedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "releasedAt"       TIMESTAMPTZ,            -- null = still suppressed
  "releasedBy"       TEXT,

  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

-- A given address is suppressed at companyGroup level (or globally when NULL).
CREATE UNIQUE INDEX "email_suppressions_addressHmac_companyGroupId_key"
  ON "email_suppressions" ("addressHmac", COALESCE("companyGroupId", ''));

CREATE INDEX "email_suppressions_addressHmac_idx"
  ON "email_suppressions" ("addressHmac")
  WHERE "releasedAt" IS NULL;

-- ============================================================
-- delivery_command_receipts
-- Idempotency log for retry / cancel / release ops.
-- ============================================================

CREATE TABLE "delivery_command_receipts" (
  "id"               TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "operationId"      TEXT        NOT NULL,
  "command"          TEXT        NOT NULL,   -- retry | cancel | release_suppression
  "actorId"          TEXT,

  "deliveryMessageId" TEXT,
  "suppressionId"     TEXT,

  "executedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "delivery_command_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_command_receipts_operationId_key"
  ON "delivery_command_receipts" ("operationId");
