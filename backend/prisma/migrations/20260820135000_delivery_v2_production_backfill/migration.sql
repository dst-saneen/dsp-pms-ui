-- Gate P0.3 / Step 2
-- Deterministic Delivery V2 backfill only.
-- Ambiguous FAILED/DELIVERED rows are intentionally left untouched for the
-- application preflight/backfill report. Plaintext is NOT dropped here.

-- Attempt outcomes
UPDATE "delivery_attempts"
SET "outcome" = 'PERMANENT_FAILURE'::"DeliveryAttemptOutcome"
WHERE "outcome" = 'REJECTED_PERMANENT';

UPDATE "delivery_attempts"
SET "outcome" = 'TRANSIENT_FAILURE'::"DeliveryAttemptOutcome"
WHERE "outcome" IN ('REJECTED_TRANSIENT', 'NETWORK_ERROR');

UPDATE "delivery_attempts"
SET "outcome" = 'AMBIGUOUS'::"DeliveryAttemptOutcome"
WHERE "outcome" = 'TIMEOUT';

-- Provider mapping
UPDATE "delivery_messages"
SET "provider" = 'INTERNAL'::"DeliveryProvider"
WHERE "provider" = 'IN_APP_STORE';

-- Recipient kind for candidate email
UPDATE "delivery_messages"
SET "recipientKind" = 'EXTERNAL_EMAIL'::"DeliveryRecipientKind"
WHERE "recipientKind" = 'CANDIDATE'
  AND "channel" = 'EMAIL';

-- Canonical eventType snapshot
UPDATE "delivery_messages"
SET "eventType" = "outboxEventType"
WHERE "eventType" IS NULL;

-- SENDING without an active lease → RETRY_WAIT (never invent PROCESSING)
UPDATE "delivery_messages"
SET "status" = 'RETRY_WAIT'::"DeliveryMessageStatus"
WHERE "status" = 'SENDING'
  AND (
    "lockExpiresAt" IS NULL
    OR "lockExpiresAt" < now()
    OR "lockedBy" IS NULL
  );

-- FAILED with permanent evidence → DEAD_LETTER
UPDATE "delivery_messages" m
SET
  "status" = 'DEAD_LETTER'::"DeliveryMessageStatus",
  "terminalAt" = COALESCE(m."terminalAt", now()),
  "deadLetteredAt" = COALESCE(m."deadLetteredAt", now())
WHERE m."status" = 'FAILED'
  AND EXISTS (
    SELECT 1
    FROM "delivery_attempts" a
    WHERE a."deliveryMessageId" = m.id
      AND a."outcome" IN ('PERMANENT_FAILURE', 'REJECTED_PERMANENT')
  );

-- FAILED with transient evidence → RETRY_WAIT
UPDATE "delivery_messages" m
SET "status" = 'RETRY_WAIT'::"DeliveryMessageStatus"
WHERE m."status" = 'FAILED'
  AND EXISTS (
    SELECT 1
    FROM "delivery_attempts" a
    WHERE a."deliveryMessageId" = m.id
      AND a."outcome" IN ('TRANSIENT_FAILURE', 'REJECTED_TRANSIENT', 'NETWORK_ERROR')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "delivery_attempts" a
    WHERE a."deliveryMessageId" = m.id
      AND a."outcome" IN ('PERMANENT_FAILURE', 'REJECTED_PERMANENT')
  );

-- FAILED with ambiguous evidence → RECONCILING
UPDATE "delivery_messages" m
SET "status" = 'RECONCILING'::"DeliveryMessageStatus"
WHERE m."status" = 'FAILED'
  AND EXISTS (
    SELECT 1
    FROM "delivery_attempts" a
    WHERE a."deliveryMessageId" = m.id
      AND a."outcome" IN ('AMBIGUOUS', 'TIMEOUT')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "delivery_attempts" a
    WHERE a."deliveryMessageId" = m.id
      AND a."outcome" IN (
        'PERMANENT_FAILURE',
        'REJECTED_PERMANENT',
        'TRANSIENT_FAILURE',
        'REJECTED_TRANSIENT',
        'NETWORK_ERROR'
      )
  );

-- Ensure terminal timestamps for already-terminal legacy rows
UPDATE "delivery_messages"
SET "terminalAt" = COALESCE("terminalAt", "updatedAt", now())
WHERE "status" IN ('DEAD_LETTER', 'BYPASSED', 'CANCELLED')
  AND "terminalAt" IS NULL;

UPDATE "delivery_messages"
SET "deadLetteredAt" = COALESCE("deadLetteredAt", "terminalAt", now())
WHERE "status" = 'DEAD_LETTER'
  AND "deadLetteredAt" IS NULL;
