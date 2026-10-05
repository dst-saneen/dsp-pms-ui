export const DELIVERY_V2_PREFLIGHT_ID_LIMIT = 200;

export type DeliveryV2FindingCode =
  | 'MESSAGE_PLAINTEXT_MISSING_ENCRYPTED_SNAPSHOT'
  | 'MESSAGE_MISSING_COMPANY_OR_BRANCH'
  | 'DUPLICATE_CLIENT_REFERENCE'
  | 'DUPLICATE_DEDUPE_KEY'
  | 'SENDING_WITHOUT_ACTIVE_LEASE'
  | 'FAILED_WITHOUT_DETERMINISTIC_CLASSIFICATION'
  | 'DELIVERED_WITHOUT_PROVIDER_EVENT'
  | 'DUPLICATE_ATTEMPT_NUMBERS'
  | 'PROVIDER_EVENT_UNCORRELATED'
  | 'DUPLICATE_PROVIDER_EVENT_ID'
  | 'DUPLICATE_PROVIDER_PAYLOAD_DIGEST'
  | 'SUPPRESSION_MISSING_COMPANY'
  | 'RECEIPT_MISSING_COMPANY_OR_ACTOR';

export interface DeliveryV2SqlCheck {
  code: DeliveryV2FindingCode;
  sql: string;
}

function idSelect(sql: string): string {
  return `${sql.trim().replace(/;+\s*$/, '')} LIMIT ${DELIVERY_V2_PREFLIGHT_ID_LIMIT}`;
}

/** Read-only exception queries (Gate P0.3). Each statement returns `id`. */
export const DELIVERY_V2_PREFLIGHT_CHECKS: readonly DeliveryV2SqlCheck[] = [
  {
    code: 'MESSAGE_PLAINTEXT_MISSING_ENCRYPTED_SNAPSHOT',
    sql: idSelect(`
      SELECT m.id
      FROM delivery_messages m
      WHERE m.channel = 'EMAIL'
        AND (
          nullif(trim(m."toAddress"), '') IS NOT NULL
          OR nullif(trim(m.subject), '') IS NOT NULL
        )
        AND (
          m."recipientAddressCiphertext" IS NULL
          OR m."subjectCiphertext" IS NULL
        )
      ORDER BY m.id
    `),
  },
  {
    code: 'MESSAGE_MISSING_COMPANY_OR_BRANCH',
    sql: idSelect(`
      SELECT m.id
      FROM delivery_messages m
      WHERE m."companyId" IS NULL
         OR m."branchId" IS NULL
      ORDER BY m.id
    `),
  },
  {
    code: 'DUPLICATE_CLIENT_REFERENCE',
    sql: idSelect(`
      SELECT m.id
      FROM delivery_messages m
      WHERE m."clientReference" IS NOT NULL
        AND m."clientReference" IN (
          SELECT "clientReference"
          FROM delivery_messages
          WHERE "clientReference" IS NOT NULL
          GROUP BY "clientReference"
          HAVING COUNT(*) > 1
        )
      ORDER BY m.id
    `),
  },
  {
    code: 'DUPLICATE_DEDUPE_KEY',
    sql: idSelect(`
      SELECT m.id
      FROM delivery_messages m
      WHERE m."dedupeKey" IN (
        SELECT "dedupeKey"
        FROM delivery_messages
        GROUP BY "dedupeKey"
        HAVING COUNT(*) > 1
      )
      ORDER BY m.id
    `),
  },
  {
    code: 'SENDING_WITHOUT_ACTIVE_LEASE',
    sql: idSelect(`
      SELECT m.id
      FROM delivery_messages m
      WHERE m.status = 'SENDING'
        AND (
          m."lockExpiresAt" IS NULL
          OR m."lockExpiresAt" < now()
          OR m."lockedBy" IS NULL
        )
      ORDER BY m.id
    `),
  },
  {
    code: 'FAILED_WITHOUT_DETERMINISTIC_CLASSIFICATION',
    sql: idSelect(`
      SELECT m.id
      FROM delivery_messages m
      WHERE m.status = 'FAILED'
        AND NOT EXISTS (
          SELECT 1
          FROM delivery_attempts a
          WHERE a."deliveryMessageId" = m.id
            AND a.outcome IN (
              'REJECTED_PERMANENT',
              'PERMANENT_FAILURE',
              'REJECTED_TRANSIENT',
              'NETWORK_ERROR',
              'TRANSIENT_FAILURE',
              'TIMEOUT',
              'AMBIGUOUS'
            )
        )
      ORDER BY m.id
    `),
  },
  {
    code: 'DELIVERED_WITHOUT_PROVIDER_EVENT',
    sql: idSelect(`
      SELECT m.id
      FROM delivery_messages m
      WHERE m.status = 'DELIVERED'
        AND m.channel = 'EMAIL'
        AND NOT EXISTS (
          SELECT 1
          FROM delivery_provider_events e
          WHERE e."deliveryMessageId" = m.id
            AND (
              lower(e."eventType") LIKE '%deliver%'
              OR lower(coalesce(e."normalizedEventType", '')) LIKE '%deliver%'
            )
        )
      ORDER BY m.id
    `),
  },
  {
    code: 'DUPLICATE_ATTEMPT_NUMBERS',
    sql: idSelect(`
      SELECT a.id
      FROM delivery_attempts a
      WHERE EXISTS (
        SELECT 1
        FROM delivery_attempts b
        WHERE b."deliveryMessageId" = a."deliveryMessageId"
          AND b."attemptNo" = a."attemptNo"
          AND b.id <> a.id
      )
      ORDER BY a.id
    `),
  },
  {
    code: 'PROVIDER_EVENT_UNCORRELATED',
    sql: idSelect(`
      SELECT e.id
      FROM delivery_provider_events e
      WHERE e."deliveryMessageId" IS NULL
        AND (
          e."clientReference" IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM delivery_messages m
            WHERE m."clientReference" = e."clientReference"
               OR m.id = e."clientReference"
          )
        )
      ORDER BY e.id
    `),
  },
  {
    code: 'DUPLICATE_PROVIDER_EVENT_ID',
    sql: idSelect(`
      SELECT e.id
      FROM delivery_provider_events e
      WHERE e."providerEventId" IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM delivery_provider_events x
          WHERE x.provider = e.provider
            AND x."providerEventId" = e."providerEventId"
            AND x.id <> e.id
        )
      ORDER BY e.id
    `),
  },
  {
    code: 'DUPLICATE_PROVIDER_PAYLOAD_DIGEST',
    sql: idSelect(`
      SELECT e.id
      FROM delivery_provider_events e
      WHERE e."providerEventId" IS NULL
        AND e."canonicalPayloadDigest" IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM delivery_provider_events x
          WHERE x.provider = e.provider
            AND x."providerEventId" IS NULL
            AND x."canonicalPayloadDigest" = e."canonicalPayloadDigest"
            AND x.id <> e.id
        )
      ORDER BY e.id
    `),
  },
  {
    code: 'SUPPRESSION_MISSING_COMPANY',
    sql: idSelect(`
      SELECT s.id
      FROM email_suppressions s
      WHERE s."companyId" IS NULL
      ORDER BY s.id
    `),
  },
  {
    code: 'RECEIPT_MISSING_COMPANY_OR_ACTOR',
    sql: idSelect(`
      SELECT r.id
      FROM delivery_command_receipts r
      WHERE r."companyId" IS NULL
         OR (r."actorUserId" IS NULL AND r."actorId" IS NULL)
      ORDER BY r.id
    `),
  },
];
