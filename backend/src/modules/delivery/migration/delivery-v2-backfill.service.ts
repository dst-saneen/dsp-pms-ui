import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
} from 'node:crypto';

import {
  mapLegacyAttemptOutcome,
  mapLegacyMessageStatus,
  mapProvider,
  mapRecipientKind,
} from './delivery-v2-backfill.rules';
import {
  DELIVERY_V2_BLOCKING_FINDINGS,
  runDeliveryV2Preflight,
  type DeliveryV2PreflightReport,
  type DeliveryV2QueryClient,
} from './delivery-v2-preflight.service';

export interface DeliveryV2BackfillOptions {
  apply: boolean;
  contentEncryptionKey?: Buffer;
  contentKeyVersion?: string;
  addressHmacKey?: Buffer;
  addressHmacKeyVersion?: string;
  workerLeaseSeconds?: number;
}

export interface DeliveryV2BackfillReport {
  generatedAt: string;
  dryRun: boolean;
  preflight: DeliveryV2PreflightReport;
  updates: {
    attemptOutcomes: number;
    providers: number;
    recipientKinds: number;
    statuses: number;
    encryptedSnapshots: number;
    inAppUsers: number;
    eventTypesCopied: number;
    skippedAmbiguous: number;
  };
  blocked: boolean;
  notes: string[];
}

type MessageRow = {
  id: string;
  status: string;
  channel: string;
  provider: string;
  recipientKind: string;
  recipientId: string;
  companyId: string | null;
  branchId: string | null;
  toAddress: string | null;
  subject: string | null;
  recipientAddressCiphertext: string | null;
  subjectCiphertext: string | null;
  lockedBy: string | null;
  lockExpiresAt: Date | string | null;
  outboxEventType: string;
  eventType: string | null;
  aggregateType: string | null;
  aggregateId: string | null;
};

function encryptField(
  plaintext: string,
  key: Buffer,
): { ciphertext: string; nonce: string; authTag: string } {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    nonce: nonce.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function addressHmac(address: string, key: Buffer): string {
  const normalized = address.trim().toLowerCase();
  return createHmac('sha256', key).update(normalized).digest('hex');
}

export async function runDeliveryV2Backfill(
  prisma: DeliveryV2QueryClient & {
    $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
    $transaction?<T>(
      fn: (
        tx: DeliveryV2QueryClient & {
          $executeRawUnsafe(
            query: string,
            ...values: unknown[]
          ): Promise<unknown>;
        },
      ) => Promise<T>,
    ): Promise<T>;
  },
  meta: { databaseName: string; databaseSchema: string },
  options: DeliveryV2BackfillOptions,
): Promise<DeliveryV2BackfillReport> {
  const preflight = await runDeliveryV2Preflight(prisma, meta);
  const notes: string[] = [];
  const updates = {
    attemptOutcomes: 0,
    providers: 0,
    recipientKinds: 0,
    statuses: 0,
    encryptedSnapshots: 0,
    inAppUsers: 0,
    eventTypesCopied: 0,
    skippedAmbiguous: 0,
  };

  const blocked = preflight.findings.some((finding) =>
    DELIVERY_V2_BLOCKING_FINDINGS.has(finding.code),
  );

  if (blocked) {
    notes.push(
      'Blocking preflight findings present. Deterministic non-status mappings may still run; ambiguous status rows are skipped.',
    );
  }

  const run = async (
    client: DeliveryV2QueryClient & {
      $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
    },
  ) => {
    // 1) Attempt outcomes (legacy → canonical)
    const attemptRows = (await client.$queryRawUnsafe(`
      SELECT id, outcome
      FROM delivery_attempts
      WHERE outcome IN (
        'REJECTED_PERMANENT',
        'REJECTED_TRANSIENT',
        'TIMEOUT',
        'NETWORK_ERROR'
      )
    `)) as Array<{ id: string; outcome: string }>;

    for (const row of attemptRows) {
      const mapped = mapLegacyAttemptOutcome(row.outcome);
      if (!mapped || mapped === row.outcome) {
        continue;
      }
      updates.attemptOutcomes += 1;
      if (options.apply) {
        await client.$executeRawUnsafe(
          `UPDATE delivery_attempts SET outcome = $1::"DeliveryAttemptOutcome" WHERE id = $2`,
          mapped,
          row.id,
        );
      }
    }

    // 2) Provider IN_APP_STORE → INTERNAL
    const providerRows = (await client.$queryRawUnsafe(`
      SELECT id
      FROM delivery_messages
      WHERE provider = 'IN_APP_STORE'
    `)) as Array<{ id: string }>;
    updates.providers = providerRows.length;
    if (options.apply && providerRows.length > 0) {
      await client.$executeRawUnsafe(`
        UPDATE delivery_messages
        SET provider = 'INTERNAL'::"DeliveryProvider"
        WHERE provider = 'IN_APP_STORE'
      `);
    }

    // 3) CANDIDATE + EMAIL → EXTERNAL_EMAIL
    const candidateEmailRows = (await client.$queryRawUnsafe(`
      SELECT id
      FROM delivery_messages
      WHERE "recipientKind" = 'CANDIDATE'
        AND channel = 'EMAIL'
    `)) as Array<{ id: string }>;
    updates.recipientKinds = candidateEmailRows.length;
    if (options.apply && candidateEmailRows.length > 0) {
      await client.$executeRawUnsafe(`
        UPDATE delivery_messages
        SET "recipientKind" = 'EXTERNAL_EMAIL'::"DeliveryRecipientKind"
        WHERE "recipientKind" = 'CANDIDATE'
          AND channel = 'EMAIL'
      `);
    }

    // 4) Copy eventType from outboxEventType when blank
    const eventTypeRows = (await client.$queryRawUnsafe(`
      SELECT id
      FROM delivery_messages
      WHERE "eventType" IS NULL
    `)) as Array<{ id: string }>;
    updates.eventTypesCopied = eventTypeRows.length;
    if (options.apply && eventTypeRows.length > 0) {
      await client.$executeRawUnsafe(`
        UPDATE delivery_messages
        SET "eventType" = "outboxEventType"
        WHERE "eventType" IS NULL
      `);
    }

    // 5) IN_APP → USER when recipientId matches a User in company scope
    const inAppRows = (await client.$queryRawUnsafe(`
      SELECT m.id, m."recipientId", m."companyId", m."recipientKind", m.channel
      FROM delivery_messages m
      WHERE m.channel = 'IN_APP'
        AND m."recipientUserId" IS NULL
        AND m."recipientKind" IN ('EMPLOYEE', 'HR', 'PANEL_MEMBER', 'SYSTEM', 'USER')
    `)) as Array<{
      id: string;
      recipientId: string;
      companyId: string | null;
      recipientKind: string;
      channel: string;
    }>;

    for (const row of inAppRows) {
      const users = (await client.$queryRawUnsafe(
        `
          SELECT u.id
          FROM users u
          LEFT JOIN employees e ON e.id = u."employeeId"
          WHERE u.id = $1
             OR e.id = $1
          LIMIT 1
        `,
        row.recipientId,
      )) as Array<{ id: string }>;
      const userId = users[0]?.id;
      if (!userId) {
        updates.skippedAmbiguous += 1;
        continue;
      }
      updates.inAppUsers += 1;
      if (options.apply) {
        await client.$executeRawUnsafe(
          `
            UPDATE delivery_messages
            SET "recipientUserId" = $1,
                "recipientKind" = 'USER'::"DeliveryRecipientKind"
            WHERE id = $2
          `,
          userId,
          row.id,
        );
      }
    }

    // 6) Status mapping (never guess)
    const messages = (await client.$queryRawUnsafe(`
      SELECT
        m.id,
        m.status::text AS status,
        m.channel::text AS channel,
        m.provider::text AS provider,
        m."recipientKind"::text AS "recipientKind",
        m."recipientId",
        m."companyId",
        m."branchId",
        m."toAddress",
        m.subject,
        m."recipientAddressCiphertext",
        m."subjectCiphertext",
        m."lockedBy",
        m."lockExpiresAt",
        m."outboxEventType",
        m."eventType",
        m."aggregateType",
        m."aggregateId"
      FROM delivery_messages m
      WHERE m.status::text IN ('SENDING', 'FAILED', 'DELIVERED', 'QUEUED', 'DEAD_LETTER', 'BYPASSED', 'CANCELLED')
    `)) as MessageRow[];

    for (const message of messages) {
      const lockExpiresMs = message.lockExpiresAt
        ? new Date(message.lockExpiresAt).getTime()
        : 0;
      const hasActiveLease = Boolean(
        message.lockedBy && lockExpiresMs > Date.now(),
      );

      const deliveredEvents = (await client.$queryRawUnsafe(
        `
          SELECT e.id
          FROM delivery_provider_events e
          WHERE e."deliveryMessageId" = $1
            AND (
              lower(e."eventType") LIKE '%deliver%'
              OR lower(coalesce(e."normalizedEventType", '')) LIKE '%deliver%'
            )
          LIMIT 1
        `,
        message.id,
      )) as Array<{ id: string }>;

      const latestAttempt = (await client.$queryRawUnsafe(
        `
          SELECT outcome::text AS outcome
          FROM delivery_attempts
          WHERE "deliveryMessageId" = $1
          ORDER BY "attemptNo" DESC
          LIMIT 1
        `,
        message.id,
      )) as Array<{ outcome: string }>;

      const mappedStatus = mapLegacyMessageStatus({
        status: message.status,
        hasActiveLease,
        hasProviderDeliveredEvent: deliveredEvents.length > 0,
        latestAttemptOutcome: latestAttempt[0]?.outcome ?? null,
      });

      if (!mappedStatus) {
        if (message.status === 'FAILED' || message.status === 'DELIVERED') {
          updates.skippedAmbiguous += 1;
        }
        continue;
      }

      if (mappedStatus !== message.status) {
        updates.statuses += 1;
        if (options.apply) {
          const terminalAt =
            mappedStatus === 'DEAD_LETTER' ||
            mappedStatus === 'BYPASSED' ||
            mappedStatus === 'CANCELLED' ||
            mappedStatus === 'DELIVERED'
              ? new Date()
              : null;
          await client.$executeRawUnsafe(
            `
              UPDATE delivery_messages
              SET status = $1::"DeliveryMessageStatus",
                  "terminalAt" = COALESCE("terminalAt", $2::timestamptz),
                  "deadLetteredAt" = CASE
                    WHEN $1 = 'DEAD_LETTER' THEN COALESCE("deadLetteredAt", now())
                    ELSE "deadLetteredAt"
                  END,
                  provider = CASE
                    WHEN provider = 'IN_APP_STORE' THEN 'INTERNAL'::"DeliveryProvider"
                    ELSE provider
                  END
              WHERE id = $3
            `,
            mappedStatus,
            terminalAt,
            message.id,
          );
        }
      }

      // Encrypt plaintext snapshots when keys are available (never log plaintext).
      if (
        message.channel === 'EMAIL' &&
        options.contentEncryptionKey &&
        options.addressHmacKey &&
        ((message.toAddress && !message.recipientAddressCiphertext) ||
          (message.subject && !message.subjectCiphertext))
      ) {
        updates.encryptedSnapshots += 1;
        if (options.apply) {
          const address = message.toAddress?.trim() ?? '';
          const subject = message.subject?.trim() ?? '';
          const addressParts = address
            ? encryptField(address, options.contentEncryptionKey)
            : null;
          const subjectParts = subject
            ? encryptField(subject, options.contentEncryptionKey)
            : null;
          const hmac = address
            ? addressHmac(address, options.addressHmacKey)
            : null;

          await client.$executeRawUnsafe(
            `
              UPDATE delivery_messages
              SET
                "recipientAddressCiphertext" = COALESCE("recipientAddressCiphertext", $1),
                "recipientAddressNonce" = COALESCE("recipientAddressNonce", $2),
                "recipientAddressAuthTag" = COALESCE("recipientAddressAuthTag", $3),
                "recipientAddressKeyVersion" = COALESCE("recipientAddressKeyVersion", $4),
                "recipientAddressHmac" = COALESCE("recipientAddressHmac", $5),
                "recipientAddressHmacKeyVersion" = COALESCE("recipientAddressHmacKeyVersion", $6),
                "subjectCiphertext" = COALESCE("subjectCiphertext", $7),
                "contentNonce" = COALESCE("contentNonce", $8),
                "contentAuthTag" = COALESCE("contentAuthTag", $9),
                "contentKeyVersion" = COALESCE("contentKeyVersion", $4)
              WHERE id = $10
            `,
            addressParts?.ciphertext ?? null,
            addressParts?.nonce ?? null,
            addressParts?.authTag ?? null,
            options.contentKeyVersion ?? 'v1',
            hmac,
            options.addressHmacKeyVersion ?? 'v1',
            subjectParts?.ciphertext ?? null,
            subjectParts?.nonce ?? null,
            subjectParts?.authTag ?? null,
            message.id,
          );
        }
      }
    }
  };

  if (options.apply && typeof prisma.$transaction === 'function') {
    await prisma.$transaction(async (tx) => run(tx));
  } else {
    await run(prisma);
  }

  if (!options.contentEncryptionKey) {
    notes.push(
      'Content encryption key not provided; plaintext snapshot encryption was skipped.',
    );
  }

  // Re-run preflight after apply so the report reflects post-backfill state.
  const finalPreflight = options.apply
    ? await runDeliveryV2Preflight(prisma, meta)
    : preflight;

  return {
    generatedAt: new Date().toISOString(),
    dryRun: !options.apply,
    preflight: finalPreflight,
    updates,
    blocked: finalPreflight.blockingExceptionCount > 0,
    notes,
  };
}

/** Stable digest helper for provider event dedupe (no plaintext logging). */
export function digestProviderPayload(payload: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(payload ?? {}))
    .digest('hex');
}

// Keep rule helpers re-exported for tests/scripts.
export {
  mapLegacyAttemptOutcome,
  mapLegacyMessageStatus,
  mapProvider,
  mapRecipientKind,
};
