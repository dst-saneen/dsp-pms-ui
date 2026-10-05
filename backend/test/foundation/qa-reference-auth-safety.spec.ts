import {
  deleteExactAuthSessionCacheKeys,
  readReferenceCleanupRedisConfig,
  type ExactRedisKeyClient,
} from '../../scripts/qa/cleanup-reference-auth-sessions';
import { buildUnexpiredPendingCredentialChallengeWhere } from '../../scripts/qa/reference-persona-seeder';

describe('QA reference authentication safety', () => {
  it('deletes and verifies only the exact prefixed AuthSession cache keys', async () => {
    const deletedBatches: string[][] = [];
    const checkedBatches: string[][] = [];
    const client: ExactRedisKeyClient = {
      del: (...keys) => {
        deletedBatches.push(keys);
        return Promise.resolve(keys.length);
      },
      exists: (...keys) => {
        checkedBatches.push(keys);
        return Promise.resolve(0);
      },
    };
    const firstSessionId = '11111111-1111-4111-8111-111111111111';
    const secondSessionId = '22222222-2222-4222-8222-222222222222';

    await expect(
      deleteExactAuthSessionCacheKeys(client, 'qa-staging:', [
        firstSessionId,
        secondSessionId,
        firstSessionId,
      ]),
    ).resolves.toEqual({ requested: 2, deleted: 2, remaining: 0 });
    expect(deletedBatches).toEqual([
      [
        `qa-staging:auth:session:${firstSessionId}`,
        `qa-staging:auth:session:${secondSessionId}`,
      ],
    ]);
    expect(checkedBatches).toEqual(deletedBatches);
    expect(deletedBatches.flat().every((key) => !key.includes('*'))).toBe(true);
  });

  it('rejects an invalid session identifier before issuing a Redis command', async () => {
    let commandCount = 0;
    const client: ExactRedisKeyClient = {
      del: () => {
        commandCount += 1;
        return Promise.resolve(0);
      },
      exists: () => {
        commandCount += 1;
        return Promise.resolve(0);
      },
    };

    await expect(
      deleteExactAuthSessionCacheKeys(client, 'qa-staging:', ['*']),
    ).rejects.toThrow('invalid AuthSession id');
    expect(commandCount).toBe(0);
  });

  it('requires an explicit Redis mode and complete bounded configuration', () => {
    expect(readReferenceCleanupRedisConfig({ REDIS_ENABLED: 'false' })).toBe(
      null,
    );
    expect(() => readReferenceCleanupRedisConfig({})).toThrow(
      'REDIS_ENABLED must be explicitly true or false',
    );
    expect(
      readReferenceCleanupRedisConfig({
        REDIS_ENABLED: 'true',
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: '6379',
        REDIS_DB: '3',
        REDIS_KEY_PREFIX: 'qa-staging:',
        REDIS_CONNECT_TIMEOUT_MS: '1000',
        REDIS_COMMAND_TIMEOUT_MS: '500',
      }),
    ).toEqual({
      host: '127.0.0.1',
      port: 6379,
      password: undefined,
      db: 3,
      keyPrefix: 'qa-staging:',
      connectTimeout: 1000,
      commandTimeout: 500,
    });
  });

  it('blocks credential rotation only for unexpired pending challenges', () => {
    const now = new Date('2026-09-17T10:00:00.000Z');

    expect(
      buildUnexpiredPendingCredentialChallengeWhere('qa-user-id', now),
    ).toEqual({
      userId: 'qa-user-id',
      consumedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    });
  });
});
