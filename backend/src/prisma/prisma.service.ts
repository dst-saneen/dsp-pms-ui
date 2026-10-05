import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import type { QueryConfig } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Environment } from '../config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger: Logger;
  private readonly pool: Pool;
  private readonly databaseSchema: string;
  private readonly connectAttempts: number;
  private readonly connectRetryDelayMs: number;

  constructor(
    private readonly configService: ConfigService<Environment, true>,
  ) {
    const logger = new Logger(PrismaService.name);
    const databaseUrl = configService.getOrThrow('DATABASE_URL', {
      infer: true,
    });
    const databaseSchema = configService.getOrThrow('DATABASE_SCHEMA', {
      infer: true,
    });

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseSchema)) {
      throw new Error(
        'DATABASE_SCHEMA must contain a valid PostgreSQL identifier.',
      );
    }

    const runtimeUrl = new URL(
      databaseUrl.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, 'postgresql://'),
    );

    runtimeUrl.searchParams.delete('schema');

    const sslMode = configService.get('DATABASE_SSL_MODE', {
      infer: true,
    });
    const sslCaPath = configService.get('DATABASE_SSL_CA', {
      infer: true,
    });

    if (sslCaPath) {
      runtimeUrl.searchParams.delete('sslmode');
    } else if (sslMode) {
      runtimeUrl.searchParams.set('sslmode', sslMode);
    }

    const ssl = sslCaPath
      ? {
          ca: readFileSync(resolve(process.cwd(), sslCaPath), 'utf8'),
          rejectUnauthorized: true,
        }
      : undefined;

    const pool = new Pool({
      connectionString: runtimeUrl.toString(),
      max: configService.getOrThrow('DATABASE_POOL_SIZE', { infer: true }),
      connectionTimeoutMillis: configService.getOrThrow(
        'DATABASE_CONNECTION_TIMEOUT_MS',
        { infer: true },
      ),
      idleTimeoutMillis: configService.getOrThrow('DATABASE_IDLE_TIMEOUT_MS', {
        infer: true,
      }),
      query_timeout: configService.getOrThrow('DATABASE_QUERY_TIMEOUT_MS', {
        infer: true,
      }),
      statement_timeout: configService.getOrThrow(
        'DATABASE_STATEMENT_TIMEOUT_MS',
        { infer: true },
      ),
      lock_timeout: configService.getOrThrow('DATABASE_LOCK_TIMEOUT_MS', {
        infer: true,
      }),
      idle_in_transaction_session_timeout: configService.getOrThrow(
        'DATABASE_IDLE_TRANSACTION_TIMEOUT_MS',
        { infer: true },
      ),
      maxLifetimeSeconds: configService.getOrThrow(
        'DATABASE_MAX_LIFETIME_SECONDS',
        { infer: true },
      ),
      ssl,
      options: `-c search_path=${databaseSchema}`,
    });

    const adapter = new PrismaPg(pool, {
      schema: databaseSchema,
      disposeExternalPool: true,
      onPoolError: (error) => {
        logger.error({
          event: 'database.pool.error',
          errorName: error.name,
        });
      },
      onConnectionError: (error) => {
        logger.error({
          event: 'database.connection.error',
          errorName: error.name,
        });
      },
    });

    super({
      adapter,
    });

    this.logger = logger;
    this.pool = pool;
    this.databaseSchema = databaseSchema;
    this.connectAttempts = configService.getOrThrow(
      'DATABASE_CONNECT_RETRIES',
      { infer: true },
    );
    this.connectRetryDelayMs = configService.getOrThrow(
      'DATABASE_CONNECT_RETRY_DELAY_MS',
      { infer: true },
    );
  }

  async onModuleInit(): Promise<void> {
    for (let attempt = 1; attempt <= this.connectAttempts; attempt += 1) {
      try {
        await this.$connect();

        this.logger.log({
          event: 'database.connection.ready',
          attempt,
          schema: this.databaseSchema,
        });

        return;
      } catch (error) {
        const errorName =
          error instanceof Error ? error.name : 'UnknownDatabaseError';

        if (attempt === this.connectAttempts) {
          this.logger.error({
            event: 'database.connection.failed',
            attempts: this.connectAttempts,
            errorName,
          });

          throw error;
        }

        const retryDelayMs = this.connectRetryDelayMs * 2 ** (attempt - 1);

        this.logger.warn({
          event: 'database.connection.retry',
          attempt,
          nextAttempt: attempt + 1,
          retryDelayMs,
          errorName,
        });

        await new Promise((resolvePromise) =>
          setTimeout(resolvePromise, retryDelayMs),
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log({
        event: 'database.connection.closed',
      });
    } catch (error) {
      this.logger.error({
        event: 'database.connection.close_failed',
        errorName: error instanceof Error ? error.name : 'UnknownDatabaseError',
      });
    }
  }

  async checkHealth(timeoutMs: number): Promise<void> {
    const query: QueryConfig & { query_timeout: number } = {
      text: 'SELECT 1',
      query_timeout: timeoutMs,
    };

    await this.pool.query(query);
  }
}
