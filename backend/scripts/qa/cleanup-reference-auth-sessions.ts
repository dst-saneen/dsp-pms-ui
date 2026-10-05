import 'dotenv/config';

import Redis from 'ioredis';

import {
  assertQaStagingSentinel,
  assertQaWriteEnvironment,
  readQaSchemaFingerprint,
} from '../assert-destructive-db-guard';
import { createPrismaClient } from '../create-prisma-client';
import { REFERENCE_DATA_CONTRACT } from './reference-data-contract';

const AUTH_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REDIS_DELETE_BATCH_SIZE = 100;

export interface ExactRedisKeyClient {
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
}

export type ReferenceCleanupRedisConfig = {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  connectTimeout: number;
  commandTimeout: number;
};

function requiredEnvironment(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when Redis cleanup is enabled.`);
  }
  return value;
}

function integerEnvironment(
  environment: NodeJS.ProcessEnv,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const value = Number(requiredEnvironment(environment, name));
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer from ${minimum} to ${maximum}.`,
    );
  }
  return value;
}

export function readReferenceCleanupRedisConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ReferenceCleanupRedisConfig | null {
  const enabled = environment.REDIS_ENABLED?.trim().toLowerCase();
  if (enabled !== 'true' && enabled !== 'false') {
    throw new Error('REDIS_ENABLED must be explicitly true or false.');
  }
  if (enabled === 'false') {
    return null;
  }

  return {
    host: requiredEnvironment(environment, 'REDIS_HOST'),
    port: integerEnvironment(environment, 'REDIS_PORT', 1, 65_535),
    password: environment.REDIS_PASSWORD?.trim() || undefined,
    db: integerEnvironment(environment, 'REDIS_DB', 0, 15),
    keyPrefix: requiredEnvironment(environment, 'REDIS_KEY_PREFIX'),
    connectTimeout: integerEnvironment(
      environment,
      'REDIS_CONNECT_TIMEOUT_MS',
      100,
      60_000,
    ),
    commandTimeout: integerEnvironment(
      environment,
      'REDIS_COMMAND_TIMEOUT_MS',
      100,
      60_000,
    ),
  };
}

export async function deleteExactAuthSessionCacheKeys(
  client: ExactRedisKeyClient,
  keyPrefix: string,
  sessionIds: ReadonlyArray<string>,
): Promise<{ requested: number; deleted: number; remaining: number }> {
  const uniqueSessionIds = [...new Set(sessionIds)];
  if (
    uniqueSessionIds.some(
      (sessionId) => !AUTH_SESSION_ID_PATTERN.test(sessionId),
    )
  ) {
    throw new Error('Refusing Redis cleanup for an invalid AuthSession id.');
  }

  const keys = uniqueSessionIds.map(
    (sessionId) => `${keyPrefix}auth:session:${sessionId}`,
  );
  let deleted = 0;
  let remaining = 0;
  for (let index = 0; index < keys.length; index += REDIS_DELETE_BATCH_SIZE) {
    const batch = keys.slice(index, index + REDIS_DELETE_BATCH_SIZE);
    deleted += await client.del(...batch);
    remaining += await client.exists(...batch);
  }
  if (remaining !== 0) {
    throw new Error(
      'Exact reference AuthSession Redis keys remain after invalidation.',
    );
  }
  return { requested: keys.length, deleted, remaining };
}

async function connectCleanupRedis(
  config: ReferenceCleanupRedisConfig,
): Promise<Redis> {
  const client = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    connectTimeout: config.connectTimeout,
    commandTimeout: config.commandTimeout,
    retryStrategy: () => null,
  });
  client.on('error', () => undefined);
  try {
    await client.connect();
    if ((await client.ping()) !== 'PONG') {
      throw new Error('Redis did not acknowledge the cleanup health check.');
    }
    return client;
  } catch (error) {
    client.disconnect();
    throw new Error(
      'Reference-session cleanup could not connect to or verify Redis.',
      { cause: error },
    );
  }
}

async function disconnectCleanupRedis(
  client: Redis | undefined,
): Promise<void> {
  if (!client) return;
  try {
    if (client.status === 'ready') {
      await client.quit();
    } else {
      client.disconnect();
    }
  } catch {
    client.disconnect();
  }
}

async function main(): Promise<void> {
  const target = assertQaWriteEnvironment('cleanup-reference-auth-sessions');
  const redisConfig = readReferenceCleanupRedisConfig();
  const personaByKey = new Map(
    REFERENCE_DATA_CONTRACT.personas.map((persona) => [persona.key, persona]),
  );
  const expectedUsers = REFERENCE_DATA_CONTRACT.personaProvisioning.profiles
    .filter((profile) => profile.userRecord)
    .map((profile) => {
      const persona = personaByKey.get(profile.personaKey);
      if (!persona || !profile.username) {
        throw new Error(
          'The reference User identity contract is incomplete; no sessions were changed.',
        );
      }
      return {
        normalizedEmail: persona.email.toLocaleLowerCase('en-US'),
        normalizedUsername: profile.username.toLocaleLowerCase('en-US'),
      };
    })
    .sort((left, right) =>
      left.normalizedEmail.localeCompare(right.normalizedEmail, 'en-US'),
    );

  const databaseClient = await createPrismaClient();
  const { prisma } = databaseClient;
  let redisClient: Redis | undefined;
  try {
    await assertQaStagingSentinel(
      prisma,
      'cleanup-reference-auth-sessions',
      target,
    );
    const schemaFingerprintBefore = await readQaSchemaFingerprint(prisma);
    const users = await prisma.user.findMany({
      where: {
        normalizedEmail: {
          in: expectedUsers.map((user) => user.normalizedEmail),
        },
      },
      select: { id: true, normalizedEmail: true, normalizedUsername: true },
      orderBy: { normalizedEmail: 'asc' },
    });
    const actualUsers = users.map(
      ({ normalizedEmail, normalizedUsername }) => ({
        normalizedEmail,
        normalizedUsername,
      }),
    );
    if (JSON.stringify(actualUsers) !== JSON.stringify(expectedUsers)) {
      throw new Error(
        'The exact reference User set is missing or inconsistent; no sessions were changed.',
      );
    }

    const sessions = await prisma.authSession.findMany({
      where: {
        userId: { in: users.map((user) => user.id) },
      },
      select: { id: true, revokedAt: true },
    });
    const activeSessions = sessions.filter((session) => !session.revokedAt);
    const sessionIds = activeSessions.map((session) => session.id);
    if (redisConfig) {
      redisClient = await connectCleanupRedis(redisConfig);
    }
    const revokedAt = new Date();
    const result =
      sessionIds.length === 0
        ? { count: 0 }
        : await prisma.authSession.updateMany({
            where: { id: { in: sessionIds }, revokedAt: null },
            data: {
              revokedAt,
              revocationReason: 'QA_REFERENCE_SESSION_CLEANUP',
            },
          });
    if (result.count !== sessionIds.length) {
      throw new Error(
        'Reference-session cleanup encountered concurrent authentication activity.',
      );
    }

    const redisInvalidation =
      redisClient && redisConfig
        ? await deleteExactAuthSessionCacheKeys(
            redisClient,
            redisConfig.keyPrefix,
            sessions.map((session) => session.id),
          )
        : { requested: 0, deleted: 0, remaining: 0 };

    const remaining = await prisma.authSession.count({
      where: {
        userId: { in: users.map((user) => user.id) },
        revokedAt: null,
      },
    });
    if (remaining !== 0) {
      throw new Error('Reference-session cleanup did not reach a clean state.');
    }
    const schemaFingerprintAfter = await readQaSchemaFingerprint(prisma);
    if (schemaFingerprintAfter !== schemaFingerprintBefore) {
      throw new Error(
        'Reference-session cleanup changed the schema structure.',
      );
    }

    console.log(
      JSON.stringify(
        {
          executedAt: revokedAt.toISOString(),
          target,
          referenceUsers: users.length,
          revokedSessions: result.count,
          remainingActiveSessions: remaining,
          redisCacheInvalidation: {
            enabled: Boolean(redisClient),
            requested: redisInvalidation.requested,
            deleted: redisInvalidation.deleted,
            remaining: redisInvalidation.remaining,
          },
          schemaFingerprintBefore,
          schemaFingerprintAfter,
        },
        null,
        2,
      ),
    );
  } finally {
    await disconnectCleanupRedis(redisClient);
    await databaseClient.disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
