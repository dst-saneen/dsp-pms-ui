/**
 * Verifies Redis connectivity using backend/.env settings.
 * Usage: npm run redis:ping
 */
import { config as loadEnv } from 'dotenv';
import Redis from 'ioredis';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env') });

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return value.trim().toLowerCase() === 'true';
}

async function main(): Promise<void> {
  const enabled = readBoolean(process.env.REDIS_ENABLED, true);

  if (!enabled) {
    console.error('REDIS_ENABLED=false — enable Redis in backend/.env first.');
    process.exit(1);
  }

  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = Number(process.env.REDIS_PORT ?? 6379);
  const password = process.env.REDIS_PASSWORD?.trim() || undefined;
  const db = Number(process.env.REDIS_DB ?? 0);
  const keyPrefix = process.env.REDIS_KEY_PREFIX ?? 'dsp-pms:';
  const connectTimeout = Number(process.env.REDIS_CONNECT_TIMEOUT_MS ?? 5000);
  const commandTimeout = Number(process.env.REDIS_COMMAND_TIMEOUT_MS ?? 3000);

  const client = new Redis({
    host,
    port,
    password,
    db,
    connectTimeout,
    commandTimeout,
    maxRetriesPerRequest: 0,
    lazyConnect: true,
  });

  try {
    await client.connect();
    const ping = await client.ping();
    const probeKey = `${keyPrefix}health:probe`;
    await client.set(probeKey, 'ok', 'EX', 30);
    const probe = await client.get(probeKey);
    await client.del(probeKey);

    console.log(
      JSON.stringify(
        {
          status: 'ok',
          host,
          port,
          db,
          ping,
          readWrite: probe === 'ok',
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          status: 'error',
          host,
          port,
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

void main();
