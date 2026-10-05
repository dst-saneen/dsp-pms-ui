-- Gate P0.6 — redacted recipient-resolution exceptions (additive).

CREATE TYPE "DeliveryRecipientExceptionStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED');

CREATE TABLE "delivery_recipient_exceptions" (
    "id" TEXT NOT NULL,
    "outboxEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT,
    "aggregateId" TEXT,
    "companyGroupId" TEXT,
    "companyId" TEXT,
    "branchId" TEXT,
    "reasonCode" TEXT NOT NULL,
    "redactedDetail" TEXT,
    "status" "DeliveryRecipientExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_recipient_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_recipient_exceptions_outboxEventId_reasonCode_key"
  ON "delivery_recipient_exceptions"("outboxEventId", "reasonCode");

CREATE INDEX "delivery_recipient_exceptions_status_createdAt_idx"
  ON "delivery_recipient_exceptions"("status", "createdAt");

CREATE INDEX "delivery_recipient_exceptions_eventType_createdAt_idx"
  ON "delivery_recipient_exceptions"("eventType", "createdAt");

CREATE INDEX "delivery_recipient_exceptions_companyId_createdAt_idx"
  ON "delivery_recipient_exceptions"("companyId", "createdAt");

CREATE INDEX "delivery_recipient_exceptions_outboxEventId_idx"
  ON "delivery_recipient_exceptions"("outboxEventId");

ALTER TABLE "delivery_recipient_exceptions"
  ADD CONSTRAINT "delivery_recipient_exceptions_outboxEventId_fkey"
  FOREIGN KEY ("outboxEventId") REFERENCES "outbox_events"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
