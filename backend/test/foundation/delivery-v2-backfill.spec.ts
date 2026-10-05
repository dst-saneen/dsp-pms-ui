import {
  mapLegacyAttemptOutcome,
  mapLegacyMessageStatus,
  mapProvider,
  mapRecipientKind,
} from '../../src/modules/delivery/migration/delivery-v2-backfill.rules';
import { DELIVERY_V2_PREFLIGHT_CHECKS } from '../../src/modules/delivery/migration/delivery-v2-preflight.queries';
import {
  DELIVERY_V2_BLOCKING_FINDINGS,
  runDeliveryV2Preflight,
} from '../../src/modules/delivery/migration/delivery-v2-preflight.service';

describe('delivery-v2-backfill.rules', () => {
  it('maps attempt outcomes deterministically', () => {
    expect(mapLegacyAttemptOutcome('REJECTED_PERMANENT')).toBe(
      'PERMANENT_FAILURE',
    );
    expect(mapLegacyAttemptOutcome('REJECTED_TRANSIENT')).toBe(
      'TRANSIENT_FAILURE',
    );
    expect(mapLegacyAttemptOutcome('NETWORK_ERROR')).toBe('TRANSIENT_FAILURE');
    expect(mapLegacyAttemptOutcome('TIMEOUT')).toBe('AMBIGUOUS');
    expect(mapLegacyAttemptOutcome('ACCEPTED')).toBe('ACCEPTED');
  });

  it('maps SENDING to PROCESSING only with an active lease', () => {
    expect(
      mapLegacyMessageStatus({
        status: 'SENDING',
        hasActiveLease: true,
        hasProviderDeliveredEvent: false,
      }),
    ).toBe('PROCESSING');
    expect(
      mapLegacyMessageStatus({
        status: 'SENDING',
        hasActiveLease: false,
        hasProviderDeliveredEvent: false,
      }),
    ).toBe('RETRY_WAIT');
  });

  it('refuses to guess DELIVERED without provider evidence', () => {
    expect(
      mapLegacyMessageStatus({
        status: 'DELIVERED',
        hasActiveLease: false,
        hasProviderDeliveredEvent: false,
      }),
    ).toBeNull();
    expect(
      mapLegacyMessageStatus({
        status: 'DELIVERED',
        hasActiveLease: false,
        hasProviderDeliveredEvent: true,
      }),
    ).toBe('DELIVERED');
  });

  it('classifies FAILED from attempt evidence only', () => {
    expect(
      mapLegacyMessageStatus({
        status: 'FAILED',
        hasActiveLease: false,
        hasProviderDeliveredEvent: false,
        latestAttemptOutcome: 'REJECTED_PERMANENT',
      }),
    ).toBe('DEAD_LETTER');
    expect(
      mapLegacyMessageStatus({
        status: 'FAILED',
        hasActiveLease: false,
        hasProviderDeliveredEvent: false,
        latestAttemptOutcome: 'NETWORK_ERROR',
      }),
    ).toBe('RETRY_WAIT');
    expect(
      mapLegacyMessageStatus({
        status: 'FAILED',
        hasActiveLease: false,
        hasProviderDeliveredEvent: false,
      }),
    ).toBeNull();
  });

  it('maps recipient and provider values', () => {
    expect(
      mapRecipientKind({ recipientKind: 'CANDIDATE', channel: 'EMAIL' }),
    ).toBe('EXTERNAL_EMAIL');
    expect(mapProvider('IN_APP_STORE')).toBe('INTERNAL');
  });
});

describe('delivery-v2-preflight', () => {
  it('exposes the required Gate P0.3 checks', () => {
    const codes = DELIVERY_V2_PREFLIGHT_CHECKS.map((check) => check.code);
    expect(codes).toEqual(
      expect.arrayContaining([
        'MESSAGE_PLAINTEXT_MISSING_ENCRYPTED_SNAPSHOT',
        'MESSAGE_MISSING_COMPANY_OR_BRANCH',
        'DUPLICATE_CLIENT_REFERENCE',
        'SENDING_WITHOUT_ACTIVE_LEASE',
        'FAILED_WITHOUT_DETERMINISTIC_CLASSIFICATION',
        'DELIVERED_WITHOUT_PROVIDER_EVENT',
        'PROVIDER_EVENT_UNCORRELATED',
        'SUPPRESSION_MISSING_COMPANY',
        'RECEIPT_MISSING_COMPANY_OR_ACTOR',
      ]),
    );
  });

  it('treats duplicate and missing-scope findings as blocking', () => {
    expect(
      DELIVERY_V2_BLOCKING_FINDINGS.has('DUPLICATE_CLIENT_REFERENCE'),
    ).toBe(true);
    expect(
      DELIVERY_V2_BLOCKING_FINDINGS.has('MESSAGE_MISSING_COMPANY_OR_BRANCH'),
    ).toBe(true);
  });

  it('aggregates findings from raw query checks', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn((sql: string) => {
        if (
          sql.includes('FROM delivery_messages m') &&
          sql.includes('m."companyId" IS NULL')
        ) {
          return Promise.resolve([{ id: 'm-1' }, { id: 'm-2' }]);
        }
        return Promise.resolve([]);
      }),
    };

    const report = await runDeliveryV2Preflight(prisma, {
      databaseName: 'test',
      databaseSchema: 'dsp_pms',
    });

    expect(report.exceptionCount).toBe(2);
    expect(report.blockingExceptionCount).toBe(2);
    expect(report.findings[0]?.code).toBe('MESSAGE_MISSING_COMPANY_OR_BRANCH');
  });
});
