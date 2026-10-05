import { createHmac } from 'node:crypto';

import { AssetIdempotencyService } from '../../src/modules/asset-domain/asset-idempotency.service';
import { ASSET_ERROR_CODES } from '../../src/modules/asset-domain/policies/asset-error-codes';
import { hashAssetSourceCommand } from '../../src/modules/asset-domain/policies/asset-source-command';

describe('Asset idempotency HMAC contract', () => {
  const key = Buffer.from('0'.repeat(64), 'hex');
  const configService = {
    get: jest.fn((name: string) => {
      if (name === 'ASSET_IDEMPOTENCY_HMAC_ACTIVE_VERSION') {
        return 'v1';
      }
      if (name === 'ASSET_IDEMPOTENCY_HMAC_KEYS') {
        return { v1: key };
      }
      if (name === 'NODE_ENV') {
        return 'test';
      }
      return undefined;
    }),
  };
  const featureGate = {
    assertEnabledForCompany: jest.fn().mockResolvedValue(undefined),
  };

  it('hashes company, actor, command type, and the full payload including card numbers', () => {
    const service = new AssetIdempotencyService(
      {} as never,
      configService as never,
      featureGate as never,
    );
    const first = service.hashRequest('Company-1', 'User-1', 'CREATE_ASSET', {
      operationId: '11111111-1111-4111-8111-111111111111',
      card: { cardNumber: '4111111111111111' },
    });
    const second = service.hashRequest('company-1', 'user-1', 'CREATE_ASSET', {
      operationId: '11111111-1111-4111-8111-111111111111',
      card: { cardNumber: '4111111111111111' },
    });
    const differentCard = service.hashRequest(
      'company-1',
      'user-1',
      'CREATE_ASSET',
      {
        operationId: '11111111-1111-4111-8111-111111111111',
        card: { cardNumber: '4000000000000002' },
      },
    );

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(differentCard).not.toBe(first);
    expect(first).not.toEqual(
      createHmac('sha256', key).update('4111111111111111').digest('hex'),
    );
  });

  it('replays using the receipt key version rather than only the active key', async () => {
    const service = new AssetIdempotencyService(
      {
        assetCommandReceipt: {
          findUnique: jest.fn().mockResolvedValue({
            actorUserId: 'user-1',
            requestHash: 'stale',
            requestHashKeyVersion: 'v1',
            resultEntityId: 'asset-1',
          }),
        },
      } as never,
      configService as never,
      featureGate as never,
    );

    await expect(
      service.execute(
        { userId: 'user-1', permissions: [] },
        'company-1',
        'CREATE_ASSET',
        {
          operationId: '11111111-1111-4111-8111-111111111111',
          cardNumber: '1',
        },
        () =>
          Promise.resolve({
            entityType: 'ASSET',
            entityId: 'asset-1',
            snapshot: { id: 'asset-1' },
          }),
        () => Promise.resolve({ id: 'asset-1' }),
      ),
    ).rejects.toMatchObject({
      code: ASSET_ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
    });
  });

  it('returns the stored safe response snapshot on replay instead of reloading', async () => {
    const hashService = new AssetIdempotencyService(
      {} as never,
      configService as never,
      featureGate as never,
    );
    const requestHash = hashService.hashRequest(
      'company-1',
      'user-1',
      'CREATE_ASSET',
      { operationId: '11111111-1111-4111-8111-111111111111' },
    );
    const stored = { id: 'asset-1', version: 2, status: 'ACTIVE' };
    const replay = jest.fn().mockResolvedValue({ id: 'asset-1', version: 9 });
    const service = new AssetIdempotencyService(
      {
        assetCommandReceipt: {
          findUnique: jest.fn().mockResolvedValue({
            actorUserId: 'user-1',
            requestHash,
            requestHashKeyVersion: 'v1',
            resultEntityId: 'asset-1',
            safeResultSnapshot: stored,
          }),
        },
      } as never,
      configService as never,
      featureGate as never,
    );

    const result = await service.execute(
      { userId: 'user-1', permissions: [] },
      'company-1',
      'CREATE_ASSET',
      { operationId: '11111111-1111-4111-8111-111111111111' },
      () =>
        Promise.resolve({
          entityType: 'ASSET',
          entityId: 'asset-1',
          snapshot: { id: 'asset-1', type: 'ASSET' },
        }),
      replay,
    );

    expect(result).toEqual(stored);
    expect(replay).not.toHaveBeenCalled();
  });
});

describe('Asset source-command hash', () => {
  it('is stable for the frozen v1 field set', () => {
    const first = hashAssetSourceCommand({
      companyId: 'C1',
      sourceType: 'ONBOARDING_TASK',
      sourceId: 'task-1',
      sourceCommandKey: 'onboarding-task:task-1:assign-asset',
      employeeId: 'E1',
      assetId: 'A1',
      effectiveDate: '2026-08-18T00:00:00.000Z',
      commandKind: 'ASSIGN',
    });
    const second = hashAssetSourceCommand({
      companyId: 'c1',
      sourceType: 'ONBOARDING_TASK',
      sourceId: 'task-1',
      sourceCommandKey: 'onboarding-task:task-1:assign-asset',
      employeeId: 'e1',
      assetId: 'a1',
      effectiveDate: '2026-08-18',
      commandKind: 'ASSIGN',
    });
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});
