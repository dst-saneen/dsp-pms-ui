import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { Environment } from '../../config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly enabled: boolean;
  private readonly keyPrefix: string;
  private readonly cacheTtlSeconds: number;
  private readonly client?: Redis;
  private circuitOpenUntil = 0;
  private reconnectPromise?: Promise<boolean>;

  constructor(configService: ConfigService<Environment, true>) {
    this.enabled = configService.getOrThrow('REDIS_ENABLED', { infer: true });
    this.keyPrefix = configService.getOrThrow('REDIS_KEY_PREFIX', {
      infer: true,
    });
    this.cacheTtlSeconds = configService.getOrThrow('REDIS_CACHE_TTL', {
      infer: true,
    });

    if (!this.enabled) {
      return;
    }

    this.client = new Redis({
      host: configService.getOrThrow('REDIS_HOST', { infer: true }),
      port: configService.getOrThrow('REDIS_PORT', { infer: true }),
      password: configService.get('REDIS_PASSWORD', { infer: true }),
      db: configService.getOrThrow('REDIS_DB', { infer: true }),
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      connectTimeout: configService.getOrThrow('REDIS_CONNECT_TIMEOUT_MS', {
        infer: true,
      }),
      commandTimeout: configService.getOrThrow('REDIS_COMMAND_TIMEOUT_MS', {
        infer: true,
      }),
      retryStrategy: () => null,
    });

    this.client.on('error', (error) => {
      this.openCircuit();
      this.logger.warn({
        event: 'redis.connection.error',
        errorName: error.name,
      });
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      this.logger.warn({ event: 'redis.disabled' });
      return;
    }

    try {
      await this.client.connect();
      await this.client.ping();
      this.logger.log({ event: 'redis.connection.ready' });
    } catch (error) {
      this.openCircuit();
      this.logger.warn({
        event: 'redis.connection.unavailable',
        fallback: 'postgresql',
        errorName: error instanceof Error ? error.name : 'UnknownRedisError',
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      if (this.client.status === 'ready') {
        await this.client.quit();
      } else {
        this.client.disconnect();
      }
    } catch {
      this.client.disconnect();
    }
  }

  async get(key: string): Promise<string | undefined> {
    return this.execute(async (client) => {
      const value = await client.get(this.resolveKey(key));
      return value ?? undefined;
    });
  }

  async set(
    key: string,
    value: string,
    ttlSeconds = this.cacheTtlSeconds,
  ): Promise<void> {
    await this.execute(async (client) => {
      await client.set(this.resolveKey(key), value, 'EX', ttlSeconds);
    });
  }

  async delete(key: string): Promise<void> {
    await this.execute(async (client) => {
      await client.del(this.resolveKey(key));
    });
  }

  async incrementWithExpiry(
    key: string,
    ttlSeconds: number,
  ): Promise<number | undefined> {
    return this.execute(async (client) => {
      const resolvedKey = this.resolveKey(key);
      const value = await client.incr(resolvedKey);

      if (value === 1) {
        await client.expire(resolvedKey, ttlSeconds);
      }

      return value;
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async checkHealth(): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    if (!(await this.ensureReady())) {
      return false;
    }

    try {
      return (await this.client?.ping()) === 'PONG';
    } catch {
      this.openCircuit();
      return false;
    }
  }

  private async execute<T>(
    operation: (client: Redis) => Promise<T>,
  ): Promise<T | undefined> {
    if (!this.client || !(await this.ensureReady())) {
      return undefined;
    }

    try {
      return await operation(this.client);
    } catch {
      this.openCircuit();
      return undefined;
    }
  }

  private resolveKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private isCircuitOpen(): boolean {
    return Date.now() < this.circuitOpenUntil;
  }

  private openCircuit(): void {
    this.circuitOpenUntil = Date.now() + 10_000;
  }

  private async ensureReady(): Promise<boolean> {
    if (!this.client || this.isCircuitOpen()) {
      return false;
    }

    if (this.client.status === 'ready') {
      return true;
    }

    if (this.client.status !== 'end' && this.client.status !== 'wait') {
      return false;
    }

    this.reconnectPromise ??= this.client
      .connect()
      .then(async () => {
        await this.client?.ping();
        this.circuitOpenUntil = 0;
        return true;
      })
      .catch(() => {
        this.openCircuit();
        return false;
      })
      .finally(() => {
        this.reconnectPromise = undefined;
      });

    return this.reconnectPromise;
  }
}
