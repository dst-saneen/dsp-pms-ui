import { LogLevel } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  isAssetCardKekConfigured,
  parseAssetIdempotencyHmacKeys,
} from './asset-security-env';
import {
  parseFinanceBankReferenceEncKeys,
  parseFinanceIdempotencyHmacKeys,
  parsePayrollIdempotencyHmacKeys,
} from './business-security-env';
import { parseDeliveryVersionedKeys } from './delivery-security-env';
import { parseFileNameEncryptionKeys } from './file-storage-security-env';

const POSTGRES_PROTOCOLS = new Set([
  'postgres:',
  'postgresql:',
  'postgres+asyncpg:',
  'postgresql+asyncpg:',
]);

const NODE_ENVIRONMENTS = new Set(['development', 'test', 'production']);
const LOG_LEVELS = new Set<LogLevel>([
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
]);

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = EnvironmentValidationError.name;
  }
}

export interface Environment {
  NODE_ENV: 'development' | 'test' | 'production';
  HOST: string;
  PORT: number;
  FRONTEND_URL: string;
  CORS_ORIGINS: string[];
  LOG_LEVEL: LogLevel;

  DATABASE_URL: string;
  DATABASE_SCHEMA: string;
  DATABASE_SSL_MODE?: string;
  DATABASE_SSL_CA?: string;
  DATABASE_POOL_SIZE: number;
  DATABASE_CONNECTION_TIMEOUT_MS: number;
  DATABASE_IDLE_TIMEOUT_MS: number;
  DATABASE_QUERY_TIMEOUT_MS: number;
  DATABASE_STATEMENT_TIMEOUT_MS: number;
  DATABASE_LOCK_TIMEOUT_MS: number;
  DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: number;
  DATABASE_MAX_LIFETIME_SECONDS: number;
  DATABASE_CONNECT_RETRIES: number;
  DATABASE_CONNECT_RETRY_DELAY_MS: number;
  DATABASE_HEALTH_TIMEOUT_MS: number;

  AUTH_JWT_PRIVATE_KEY_PATH: string;
  AUTH_JWT_PUBLIC_KEY_PATH: string;
  AUTH_HASH_SECRET_PATH: string;
  AUTH_ACTION_TOKEN_SECRET_PATH: string;
  AUTH_ACCESS_TOKEN_TTL_SECONDS: number;
  AUTH_SESSION_IDLE_TTL_SECONDS: number;
  AUTH_SESSION_ABSOLUTE_TTL_SECONDS: number;
  AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: number;
  AUTH_REFRESH_COOKIE_NAME: string;
  AUTH_ISSUER: string;
  AUTH_AUDIENCE: string;
  AUTH_INVITATION_TTL_SECONDS: number;
  AUTH_PASSWORD_RESET_TTL_SECONDS: number;
  AUTH_ACTION_RESEND_COOLDOWN_SECONDS: number;
  SAAS_SELF_REGISTRATION_ENABLED: boolean;

  EMAIL_ENABLED: boolean;
  EMAIL_DEV_BYPASS: boolean;
  SMTP_HOST?: string;
  SMTP_PORT: number;
  SMTP_USERNAME?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM_ADDRESS?: string;
  SMTP_FROM_NAME: string;
  SMTP_REPLY_TO?: string;
  EMAIL_CONNECTION_TIMEOUT_MS: number;
  EMAIL_SEND_TIMEOUT_MS: number;
  EMAIL_VERIFICATION_CODE_TTL_SECONDS: number;
  EMAIL_VERIFICATION_MAX_ATTEMPTS: number;
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: number;

  REDIS_ENABLED: boolean;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;
  REDIS_KEY_PREFIX: string;
  REDIS_CACHE_TTL: number;
  REDIS_CONNECT_TIMEOUT_MS: number;
  REDIS_COMMAND_TIMEOUT_MS: number;

  PUBLIC_CAREERS_ENABLED: boolean;
  RECRUITMENT_UPLOAD_DIR: string;
  RECRUITMENT_DOWNLOAD_TTL_SECONDS: number;
  TURNSTILE_SECRET_KEY?: string;
  PUBLIC_CAREERS_RATE_LIMIT_PER_HOUR: number;

  CLAMAV_HOST?: string;
  CLAMAV_PORT: number;
  CLAMAV_TIMEOUT_MS: number;
  CLAMAV_MAX_STREAM_BYTES: number;
  STORAGE_S3_REGION?: string;
  STORAGE_S3_BUCKET?: string;
  STORAGE_S3_ENDPOINT?: string;
  STORAGE_S3_ACCESS_KEY_ID?: string;
  STORAGE_S3_SECRET_ACCESS_KEY?: string;
  STORAGE_S3_PREFIX: string;
  STORAGE_PRESIGNED_PUT_TTL_SECONDS: number;
  STORAGE_PRESIGNED_GET_TTL_SECONDS: number;
  FILE_SCAN_WORKER_ENABLED: boolean;
  SIGNED_OFFER_VERIFICATION_ENABLED: boolean;
  FILE_RETENTION_PURGE_ENABLED: boolean;
  FILE_NAME_ENC_ACTIVE_KEY_VERSION: string;
  FILE_NAME_ENC_ACCEPTED_KEY_VERSIONS: string[];
  FILE_NAME_ENC_KEYS: Record<string, Buffer>;

  WORKFORCE_JOBS_ENABLED: boolean;
  WORKFORCE_JOB_BATCH_SIZE: number;
  ATTENDANCE_FINALIZER_INTERVAL_MINUTES: number;
  WORKFORCE_OUTBOX_LOCK_TIMEOUT_SECONDS: number;

  DELIVERY_CONTENT_ENCRYPTION_ACTIVE_VERSION: string;
  DELIVERY_CONTENT_ENCRYPTION_KEYS: Record<string, Buffer>;
  DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION: string;
  DELIVERY_ADDRESS_HMAC_KEYS: Record<string, Buffer>;
  DELIVERY_COMMAND_RECEIPT_HMAC_ACTIVE_VERSION: string;
  DELIVERY_COMMAND_RECEIPT_HMAC_KEYS: Record<string, Buffer>;
  DELIVERY_WORKER_LEASE_SECONDS: number;
  DELIVERY_WORKER_BATCH_SIZE: number;

  PROJECTS_REMINDERS_ENABLED: boolean;
  PROJECTS_IDEMPOTENCY_HMAC_ACTIVE_VERSION: string;
  PROJECTS_IDEMPOTENCY_HMAC_KEYS: Record<string, Buffer>;

  ONBOARDING_REMINDERS_ENABLED: boolean;
  ONBOARDING_IDEMPOTENCY_ACTIVE_KEY_VERSION: string;

  ASSET_CARD_KEK?: string;
  ASSET_IDEMPOTENCY_HMAC_ACTIVE_VERSION: string;
  ASSET_IDEMPOTENCY_HMAC_KEYS: Record<string, Buffer>;

  HR_OPERATIONS_IDEMPOTENCY_HMAC_ACTIVE_VERSION: string;
  HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS: Record<string, Buffer>;

  FINANCE_IDEMPOTENCY_HMAC_ACTIVE_VERSION: string;
  FINANCE_IDEMPOTENCY_HMAC_KEYS: Record<string, Buffer>;
  FINANCE_BANK_REFERENCE_ENC_ACTIVE_VERSION: string;
  FINANCE_BANK_REFERENCE_ENC_KEYS: Record<string, Buffer>;
  PAYROLL_IDEMPOTENCY_HMAC_ACTIVE_VERSION: string;
  PAYROLL_IDEMPOTENCY_HMAC_KEYS: Record<string, Buffer>;
}

function readString(
  config: Record<string, unknown>,
  key: string,
  defaultValue?: string,
): string {
  const rawValue = config[key];
  const value =
    typeof rawValue === 'string' ? rawValue.trim() : defaultValue?.trim();

  if (!value) {
    throw new EnvironmentValidationError(`${key} is required.`);
  }

  return value;
}

function readOptionalString(
  config: Record<string, unknown>,
  key: string,
): string | undefined {
  const rawValue = config[key];

  if (typeof rawValue !== 'string') {
    return undefined;
  }

  return rawValue.trim() || undefined;
}

function readInteger(
  config: Record<string, unknown>,
  key: string,
  defaultValue: number,
  minimum: number,
  maximum: number,
): number {
  const rawValue = config[key];
  const value =
    rawValue === undefined || rawValue === '' ? defaultValue : Number(rawValue);

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new EnvironmentValidationError(
      `${key} must be an integer between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}

function readStoragePrefix(
  config: Record<string, unknown>,
  nodeEnvironment: Environment['NODE_ENV'],
): string {
  const configured = readOptionalString(config, 'STORAGE_S3_PREFIX');
  if (!configured && nodeEnvironment === 'production') {
    throw new EnvironmentValidationError(
      'STORAGE_S3_PREFIX is required in production so object keys cannot silently use a development namespace.',
    );
  }

  const value = configured ?? nodeEnvironment;
  if (!/^[a-z0-9][a-z0-9._-]{0,62}$/.test(value)) {
    throw new EnvironmentValidationError(
      'STORAGE_S3_PREFIX must be 1-63 lowercase letters, numbers, dots, underscores, or hyphens.',
    );
  }

  if (
    nodeEnvironment === 'production' &&
    (value === 'development' || value === 'test')
  ) {
    throw new EnvironmentValidationError(
      'STORAGE_S3_PREFIX must identify the production deployment and cannot use a development or test namespace.',
    );
  }

  return value;
}

function readBoolean(
  config: Record<string, unknown>,
  key: string,
  defaultValue: boolean,
): boolean {
  const rawValue = config[key];

  if (rawValue === undefined || rawValue === '') {
    return defaultValue;
  }

  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const value = rawValue.trim().toLowerCase();

    if (value === 'true' || value === '1') {
      return true;
    }

    if (value === 'false' || value === '0') {
      return false;
    }
  }

  throw new EnvironmentValidationError(`${key} must be true or false.`);
}

function readExistingFile(
  config: Record<string, unknown>,
  key: string,
  defaultValue: string,
  allowMissing = false,
): string {
  const path = readString(config, key, defaultValue);

  if (!allowMissing && !existsSync(resolve(process.cwd(), path))) {
    throw new EnvironmentValidationError(
      `${key} must point to a readable local file.`,
    );
  }

  return path;
}

function validateHttpUrl(value: string, key: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new EnvironmentValidationError(
      `${key} must contain a valid HTTP or HTTPS URL.`,
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new EnvironmentValidationError(
      `${key} must contain a valid HTTP or HTTPS URL.`,
    );
  }

  return value;
}

function validateDatabaseUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new EnvironmentValidationError(
      'DATABASE_URL must contain a valid PostgreSQL URL.',
    );
  }

  if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
    throw new EnvironmentValidationError(
      'DATABASE_URL must contain a valid PostgreSQL URL.',
    );
  }

  return value;
}

function validateEmail(value: string, key: string): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new EnvironmentValidationError(`${key} must contain a valid email.`);
  }

  return value;
}

function readCorsOrigins(
  config: Record<string, unknown>,
  frontendUrl: string,
): string[] {
  const configuredOrigins = readOptionalString(config, 'CORS_ORIGINS');
  const origins = (configuredOrigins ?? frontendUrl)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new EnvironmentValidationError(
      'CORS_ORIGINS must contain at least one origin.',
    );
  }

  return origins.map((origin) => validateHttpUrl(origin, 'CORS_ORIGINS'));
}

function readLogLevel(config: Record<string, unknown>): LogLevel {
  const value = readString(config, 'LOG_LEVEL', 'log') as LogLevel;

  if (!LOG_LEVELS.has(value)) {
    throw new EnvironmentValidationError(
      'LOG_LEVEL must be one of fatal, error, warn, log, debug, or verbose.',
    );
  }

  return value;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> & Environment {
  const nodeEnvironment = readString(
    config,
    'NODE_ENV',
    'development',
  ) as Environment['NODE_ENV'];

  if (!NODE_ENVIRONMENTS.has(nodeEnvironment)) {
    throw new EnvironmentValidationError(
      'NODE_ENV must be one of development, test, or production.',
    );
  }

  const frontendUrl = validateHttpUrl(
    readString(config, 'FRONTEND_URL', 'http://localhost:3200'),
    'FRONTEND_URL',
  );
  const databaseUrl = validateDatabaseUrl(readString(config, 'DATABASE_URL'));
  const databaseSchema = readString(config, 'DATABASE_SCHEMA');

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(databaseSchema)) {
    throw new EnvironmentValidationError(
      'DATABASE_SCHEMA must contain a valid PostgreSQL identifier.',
    );
  }

  const sslCaPath = readOptionalString(config, 'DATABASE_SSL_CA');

  if (sslCaPath && !existsSync(resolve(process.cwd(), sslCaPath))) {
    throw new EnvironmentValidationError(
      'DATABASE_SSL_CA must point to a readable certificate file.',
    );
  }

  const redisEnabled = readBoolean(config, 'REDIS_ENABLED', true);
  const selfRegistrationEnabled = readBoolean(
    config,
    'SAAS_SELF_REGISTRATION_ENABLED',
    false,
  );
  const emailEnabled = readBoolean(config, 'EMAIL_ENABLED', false);
  const emailDevBypass = readBoolean(config, 'EMAIL_DEV_BYPASS', false);
  const smtpHost = readOptionalString(config, 'SMTP_HOST');
  const smtpUsername = readOptionalString(config, 'SMTP_USERNAME');
  const smtpPassword = readOptionalString(config, 'SMTP_PASSWORD');
  const emailFrom = readOptionalString(config, 'SMTP_FROM_ADDRESS');
  const emailReplyTo = readOptionalString(config, 'SMTP_REPLY_TO');

  if (nodeEnvironment === 'production' && emailDevBypass) {
    throw new EnvironmentValidationError(
      'EMAIL_DEV_BYPASS cannot be enabled in production.',
    );
  }

  if (
    nodeEnvironment === 'production' &&
    selfRegistrationEnabled &&
    !emailEnabled
  ) {
    throw new EnvironmentValidationError(
      'EMAIL_ENABLED must be true when production self-registration is enabled.',
    );
  }

  if (emailEnabled && !emailDevBypass) {
    const missing = [
      !smtpHost && 'SMTP_HOST',
      !smtpUsername && 'SMTP_USERNAME',
      !smtpPassword && 'SMTP_PASSWORD',
      !emailFrom && 'SMTP_FROM_ADDRESS',
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new EnvironmentValidationError(
        `${missing.join(', ')} required when email is enabled.`,
      );
    }
  }

  if (emailFrom) {
    validateEmail(emailFrom, 'SMTP_FROM_ADDRESS');
  }

  if (emailReplyTo) {
    validateEmail(emailReplyTo, 'SMTP_REPLY_TO');
  }
  const sessionIdleTtlSeconds = readInteger(
    config,
    'AUTH_SESSION_IDLE_TTL_SECONDS',
    1_800,
    300,
    86_400,
  );
  const sessionAbsoluteTtlSeconds = readInteger(
    config,
    'AUTH_SESSION_ABSOLUTE_TTL_SECONDS',
    43_200,
    sessionIdleTtlSeconds,
    2_592_000,
  );
  const authHashSecretPath = readExistingFile(
    config,
    'AUTH_HASH_SECRET_PATH',
    'certs/auth-hash-secret',
    nodeEnvironment === 'test',
  );
  const actionTokenSecretPath = readExistingFile(
    config,
    'AUTH_ACTION_TOKEN_SECRET_PATH',
    authHashSecretPath,
    nodeEnvironment === 'test',
  );

  if (
    nodeEnvironment === 'production' &&
    resolve(process.cwd(), actionTokenSecretPath) ===
      resolve(process.cwd(), authHashSecretPath)
  ) {
    throw new EnvironmentValidationError(
      'AUTH_ACTION_TOKEN_SECRET_PATH must use a dedicated secret in production.',
    );
  }

  const publicCareersEnabled = readBoolean(
    config,
    'PUBLIC_CAREERS_ENABLED',
    false,
  );

  return {
    NODE_ENV: nodeEnvironment,
    HOST: readString(config, 'HOST', '0.0.0.0'),
    PORT: readInteger(config, 'PORT', 4500, 1, 65_535),
    FRONTEND_URL: frontendUrl,
    CORS_ORIGINS: readCorsOrigins(config, frontendUrl),
    LOG_LEVEL: readLogLevel(config),
    DATABASE_URL: databaseUrl,
    DATABASE_SCHEMA: databaseSchema,
    DATABASE_SSL_MODE: readOptionalString(config, 'DATABASE_SSL_MODE'),
    DATABASE_SSL_CA: sslCaPath,
    DATABASE_POOL_SIZE: readInteger(config, 'DATABASE_POOL_SIZE', 20, 1, 1_000),
    DATABASE_CONNECTION_TIMEOUT_MS: readInteger(
      config,
      'DATABASE_CONNECTION_TIMEOUT_MS',
      10_000,
      100,
      300_000,
    ),
    DATABASE_IDLE_TIMEOUT_MS: readInteger(
      config,
      'DATABASE_IDLE_TIMEOUT_MS',
      30_000,
      1_000,
      3_600_000,
    ),
    DATABASE_QUERY_TIMEOUT_MS: readInteger(
      config,
      'DATABASE_QUERY_TIMEOUT_MS',
      30_000,
      100,
      3_600_000,
    ),
    DATABASE_STATEMENT_TIMEOUT_MS: readInteger(
      config,
      'DATABASE_STATEMENT_TIMEOUT_MS',
      30_000,
      100,
      3_600_000,
    ),
    DATABASE_LOCK_TIMEOUT_MS: readInteger(
      config,
      'DATABASE_LOCK_TIMEOUT_MS',
      5_000,
      100,
      300_000,
    ),
    DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: readInteger(
      config,
      'DATABASE_IDLE_TRANSACTION_TIMEOUT_MS',
      30_000,
      1_000,
      3_600_000,
    ),
    DATABASE_MAX_LIFETIME_SECONDS: readInteger(
      config,
      'DATABASE_MAX_LIFETIME_SECONDS',
      1_800,
      60,
      86_400,
    ),
    DATABASE_CONNECT_RETRIES: readInteger(
      config,
      'DATABASE_CONNECT_RETRIES',
      3,
      1,
      10,
    ),
    DATABASE_CONNECT_RETRY_DELAY_MS: readInteger(
      config,
      'DATABASE_CONNECT_RETRY_DELAY_MS',
      1_000,
      100,
      60_000,
    ),
    DATABASE_HEALTH_TIMEOUT_MS: readInteger(
      config,
      'DATABASE_HEALTH_TIMEOUT_MS',
      3_000,
      100,
      60_000,
    ),
    AUTH_JWT_PRIVATE_KEY_PATH: readExistingFile(
      config,
      'AUTH_JWT_PRIVATE_KEY_PATH',
      'certs/jwt-private.pem',
      nodeEnvironment === 'test',
    ),
    AUTH_JWT_PUBLIC_KEY_PATH: readExistingFile(
      config,
      'AUTH_JWT_PUBLIC_KEY_PATH',
      'certs/jwt-public.pem',
      nodeEnvironment === 'test',
    ),
    AUTH_HASH_SECRET_PATH: authHashSecretPath,
    AUTH_ACTION_TOKEN_SECRET_PATH: actionTokenSecretPath,
    AUTH_ACCESS_TOKEN_TTL_SECONDS: readInteger(
      config,
      'AUTH_ACCESS_TOKEN_TTL_SECONDS',
      600,
      60,
      3_600,
    ),
    AUTH_SESSION_IDLE_TTL_SECONDS: sessionIdleTtlSeconds,
    AUTH_SESSION_ABSOLUTE_TTL_SECONDS: sessionAbsoluteTtlSeconds,
    AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: readInteger(
      config,
      'AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS',
      300,
      30,
      sessionIdleTtlSeconds,
    ),
    AUTH_REFRESH_COOKIE_NAME: readString(
      config,
      'AUTH_REFRESH_COOKIE_NAME',
      'dsp_refresh',
    ),
    AUTH_ISSUER: readString(config, 'AUTH_ISSUER', 'group-erp'),
    AUTH_AUDIENCE: readString(config, 'AUTH_AUDIENCE', 'group-erp-web'),
    AUTH_INVITATION_TTL_SECONDS: readInteger(
      config,
      'AUTH_INVITATION_TTL_SECONDS',
      86_400,
      300,
      604_800,
    ),
    AUTH_PASSWORD_RESET_TTL_SECONDS: readInteger(
      config,
      'AUTH_PASSWORD_RESET_TTL_SECONDS',
      1_800,
      300,
      86_400,
    ),
    AUTH_ACTION_RESEND_COOLDOWN_SECONDS: readInteger(
      config,
      'AUTH_ACTION_RESEND_COOLDOWN_SECONDS',
      60,
      10,
      3_600,
    ),
    SAAS_SELF_REGISTRATION_ENABLED: selfRegistrationEnabled,
    EMAIL_ENABLED: emailEnabled,
    SMTP_HOST: smtpHost,
    SMTP_PORT: readInteger(config, 'SMTP_PORT', 587, 1, 65_535),
    SMTP_USERNAME: smtpUsername,
    SMTP_PASSWORD: smtpPassword,
    SMTP_FROM_ADDRESS: emailFrom,
    SMTP_FROM_NAME: readString(config, 'SMTP_FROM_NAME', 'Group ERP'),
    SMTP_REPLY_TO: emailReplyTo,
    EMAIL_CONNECTION_TIMEOUT_MS: readInteger(
      config,
      'EMAIL_CONNECTION_TIMEOUT_MS',
      10_000,
      100,
      120_000,
    ),
    EMAIL_SEND_TIMEOUT_MS: readInteger(
      config,
      'EMAIL_SEND_TIMEOUT_MS',
      30_000,
      1_000,
      300_000,
    ),
    EMAIL_VERIFICATION_CODE_TTL_SECONDS: readInteger(
      config,
      'EMAIL_VERIFICATION_CODE_TTL_SECONDS',
      600,
      60,
      86_400,
    ),
    EMAIL_VERIFICATION_MAX_ATTEMPTS: readInteger(
      config,
      'EMAIL_VERIFICATION_MAX_ATTEMPTS',
      5,
      1,
      20,
    ),
    EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: readInteger(
      config,
      'EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS',
      60,
      10,
      3_600,
    ),
    EMAIL_DEV_BYPASS: emailDevBypass,
    ...(() => {
      const contentActiveVersion =
        readOptionalString(
          config,
          'DELIVERY_CONTENT_ENCRYPTION_ACTIVE_VERSION',
        ) ?? 'v1';
      const addressActiveVersion =
        readOptionalString(config, 'DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION') ??
        'v1';
      const receiptActiveVersion =
        readOptionalString(
          config,
          'DELIVERY_COMMAND_RECEIPT_HMAC_ACTIVE_VERSION',
        ) ?? 'v1';

      let contentKeys: Record<string, Buffer> = {};
      let addressKeys: Record<string, Buffer> = {};
      let receiptKeys: Record<string, Buffer> = {};
      try {
        contentKeys = parseDeliveryVersionedKeys(
          readOptionalString(config, 'DELIVERY_CONTENT_ENCRYPTION_KEYS_JSON'),
          'DELIVERY_CONTENT_ENCRYPTION_KEYS_JSON',
        );
        addressKeys = parseDeliveryVersionedKeys(
          readOptionalString(config, 'DELIVERY_ADDRESS_HMAC_KEYS_JSON'),
          'DELIVERY_ADDRESS_HMAC_KEYS_JSON',
        );
        receiptKeys = parseDeliveryVersionedKeys(
          readOptionalString(config, 'DELIVERY_COMMAND_RECEIPT_HMAC_KEYS_JSON'),
          'DELIVERY_COMMAND_RECEIPT_HMAC_KEYS_JSON',
        );
      } catch (error) {
        throw new EnvironmentValidationError(
          error instanceof Error
            ? error.message
            : 'Delivery key configuration JSON is invalid.',
        );
      }

      const workerLeaseSeconds = readInteger(
        config,
        'DELIVERY_WORKER_LEASE_SECONDS',
        300,
        30,
        3_600,
      );
      const workerBatchSize = readInteger(
        config,
        'DELIVERY_WORKER_BATCH_SIZE',
        50,
        1,
        1_000,
      );

      if (nodeEnvironment === 'production') {
        if (!contentKeys[contentActiveVersion]) {
          throw new EnvironmentValidationError(
            'DELIVERY_CONTENT_ENCRYPTION_KEYS_JSON must include the active key version in production.',
          );
        }
        if (!addressKeys[addressActiveVersion]) {
          throw new EnvironmentValidationError(
            'DELIVERY_ADDRESS_HMAC_KEYS_JSON must include the active key version in production.',
          );
        }
        if (!receiptKeys[receiptActiveVersion]) {
          throw new EnvironmentValidationError(
            'DELIVERY_COMMAND_RECEIPT_HMAC_KEYS_JSON must include the active key version in production.',
          );
        }
      }

      return {
        DELIVERY_CONTENT_ENCRYPTION_ACTIVE_VERSION: contentActiveVersion,
        DELIVERY_CONTENT_ENCRYPTION_KEYS: contentKeys,
        DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION: addressActiveVersion,
        DELIVERY_ADDRESS_HMAC_KEYS: addressKeys,
        DELIVERY_COMMAND_RECEIPT_HMAC_ACTIVE_VERSION: receiptActiveVersion,
        DELIVERY_COMMAND_RECEIPT_HMAC_KEYS: receiptKeys,
        DELIVERY_WORKER_LEASE_SECONDS: workerLeaseSeconds,
        DELIVERY_WORKER_BATCH_SIZE: workerBatchSize,
      };
    })(),
    REDIS_ENABLED: redisEnabled,
    REDIS_HOST: readString(config, 'REDIS_HOST', 'localhost'),
    REDIS_PORT: readInteger(config, 'REDIS_PORT', 6_379, 1, 65_535),
    REDIS_PASSWORD: readOptionalString(config, 'REDIS_PASSWORD'),
    REDIS_DB: readInteger(config, 'REDIS_DB', 0, 0, 15),
    REDIS_KEY_PREFIX: readString(config, 'REDIS_KEY_PREFIX', 'dsp-pms:'),
    REDIS_CACHE_TTL: readInteger(config, 'REDIS_CACHE_TTL', 60, 1, 300),
    REDIS_CONNECT_TIMEOUT_MS: readInteger(
      config,
      'REDIS_CONNECT_TIMEOUT_MS',
      1_000,
      100,
      10_000,
    ),
    REDIS_COMMAND_TIMEOUT_MS: readInteger(
      config,
      'REDIS_COMMAND_TIMEOUT_MS',
      200,
      50,
      5_000,
    ),
    WORKFORCE_JOBS_ENABLED: readBoolean(
      config,
      'WORKFORCE_JOBS_ENABLED',
      false,
    ),
    WORKFORCE_JOB_BATCH_SIZE: readInteger(
      config,
      'WORKFORCE_JOB_BATCH_SIZE',
      100,
      1,
      1_000,
    ),
    ATTENDANCE_FINALIZER_INTERVAL_MINUTES: readInteger(
      config,
      'ATTENDANCE_FINALIZER_INTERVAL_MINUTES',
      15,
      1,
      1_440,
    ),
    WORKFORCE_OUTBOX_LOCK_TIMEOUT_SECONDS: readInteger(
      config,
      'WORKFORCE_OUTBOX_LOCK_TIMEOUT_SECONDS',
      300,
      30,
      3_600,
    ),
    PUBLIC_CAREERS_ENABLED: publicCareersEnabled,
    RECRUITMENT_UPLOAD_DIR: readString(
      config,
      'RECRUITMENT_UPLOAD_DIR',
      'uploads/recruitment',
    ),
    RECRUITMENT_DOWNLOAD_TTL_SECONDS: readInteger(
      config,
      'RECRUITMENT_DOWNLOAD_TTL_SECONDS',
      300,
      60,
      3_600,
    ),
    CLAMAV_HOST: readOptionalString(config, 'CLAMAV_HOST'),
    CLAMAV_PORT: readInteger(config, 'CLAMAV_PORT', 3_310, 1, 65_535),
    CLAMAV_TIMEOUT_MS: readInteger(
      config,
      'CLAMAV_TIMEOUT_MS',
      30_000,
      1_000,
      120_000,
    ),
    CLAMAV_MAX_STREAM_BYTES: readInteger(
      config,
      'CLAMAV_MAX_STREAM_BYTES',
      26_214_400,
      1_024,
      52_428_800,
    ),
    STORAGE_S3_PREFIX: readStoragePrefix(config, nodeEnvironment),
    ...readFileStorageSettings(config, nodeEnvironment),
    TURNSTILE_SECRET_KEY: readOptionalString(config, 'TURNSTILE_SECRET_KEY'),
    PUBLIC_CAREERS_RATE_LIMIT_PER_HOUR: readInteger(
      config,
      'PUBLIC_CAREERS_RATE_LIMIT_PER_HOUR',
      10,
      1,
      1_000,
    ),
    ONBOARDING_REMINDERS_ENABLED: readBoolean(
      config,
      'ONBOARDING_REMINDERS_ENABLED',
      false,
    ),
    ONBOARDING_IDEMPOTENCY_ACTIVE_KEY_VERSION: readString(
      config,
      'ONBOARDING_IDEMPOTENCY_ACTIVE_KEY_VERSION',
      'v1',
    ),
    ...readAssetSecuritySettings(config, nodeEnvironment),
    ...readBusinessSecuritySettings(config, nodeEnvironment),
  };
}

function readBusinessSecuritySettings(
  config: Record<string, unknown>,
  nodeEnvironment: Environment['NODE_ENV'],
) {
  let financeHmacKeys: Record<string, Buffer> = {};
  let payrollHmacKeys: Record<string, Buffer> = {};
  let financeBankEncKeys: Record<string, Buffer> = {};

  try {
    financeHmacKeys = parseFinanceIdempotencyHmacKeys(
      readOptionalString(config, 'FINANCE_IDEMPOTENCY_HMAC_KEYS_JSON'),
    );
  } catch (error) {
    throw new EnvironmentValidationError(
      error instanceof Error
        ? error.message
        : 'FINANCE_IDEMPOTENCY_HMAC_KEYS_JSON is invalid.',
    );
  }

  try {
    payrollHmacKeys = parsePayrollIdempotencyHmacKeys(
      readOptionalString(config, 'PAYROLL_IDEMPOTENCY_HMAC_KEYS_JSON'),
    );
  } catch (error) {
    throw new EnvironmentValidationError(
      error instanceof Error
        ? error.message
        : 'PAYROLL_IDEMPOTENCY_HMAC_KEYS_JSON is invalid.',
    );
  }

  let projectsHmacKeys: Record<string, Buffer> = {};
  let hrOperationsHmacKeys: Record<string, Buffer> = {};
  try {
    projectsHmacKeys = parseAssetIdempotencyHmacKeys(
      readOptionalString(config, 'PROJECTS_IDEMPOTENCY_HMAC_KEYS_JSON'),
    );
  } catch (error) {
    throw new EnvironmentValidationError(
      error instanceof Error
        ? error.message.replaceAll(
            'ASSET_IDEMPOTENCY_HMAC_KEYS_JSON',
            'PROJECTS_IDEMPOTENCY_HMAC_KEYS_JSON',
          )
        : 'PROJECTS_IDEMPOTENCY_HMAC_KEYS_JSON is invalid.',
    );
  }

  try {
    hrOperationsHmacKeys = parseAssetIdempotencyHmacKeys(
      readOptionalString(config, 'HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS_JSON'),
    );
  } catch (error) {
    throw new EnvironmentValidationError(
      error instanceof Error
        ? error.message.replaceAll(
            'ASSET_IDEMPOTENCY_HMAC_KEYS_JSON',
            'HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS_JSON',
          )
        : 'HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS_JSON is invalid.',
    );
  }

  try {
    financeBankEncKeys = parseFinanceBankReferenceEncKeys(
      readOptionalString(config, 'FINANCE_BANK_REFERENCE_ENC_KEYS_JSON'),
    );
  } catch (error) {
    throw new EnvironmentValidationError(
      error instanceof Error
        ? error.message
        : 'FINANCE_BANK_REFERENCE_ENC_KEYS_JSON is invalid.',
    );
  }

  const financeHmacActiveVersion =
    readOptionalString(config, 'FINANCE_IDEMPOTENCY_HMAC_ACTIVE_VERSION') ??
    'v1';
  const payrollHmacActiveVersion =
    readOptionalString(config, 'PAYROLL_IDEMPOTENCY_HMAC_ACTIVE_VERSION') ??
    'v1';
  const projectsHmacActiveVersion =
    readOptionalString(config, 'PROJECTS_IDEMPOTENCY_HMAC_ACTIVE_VERSION') ??
    'v1';
  const hrOperationsHmacActiveVersion =
    readOptionalString(
      config,
      'HR_OPERATIONS_IDEMPOTENCY_HMAC_ACTIVE_VERSION',
    ) ?? 'v1';
  const financeBankEncActiveVersion =
    readOptionalString(config, 'FINANCE_BANK_REFERENCE_ENC_ACTIVE_VERSION') ??
    'v1';

  const projectsRemindersEnabled = readBoolean(
    config,
    'PROJECTS_REMINDERS_ENABLED',
    false,
  );

  if (nodeEnvironment === 'production') {
    const missingActiveKeys = [
      !financeHmacKeys[financeHmacActiveVersion] &&
        'FINANCE_IDEMPOTENCY_HMAC_KEYS_JSON',
      !financeBankEncKeys[financeBankEncActiveVersion] &&
        'FINANCE_BANK_REFERENCE_ENC_KEYS_JSON',
      !payrollHmacKeys[payrollHmacActiveVersion] &&
        'PAYROLL_IDEMPOTENCY_HMAC_KEYS_JSON',
      !projectsHmacKeys[projectsHmacActiveVersion] &&
        'PROJECTS_IDEMPOTENCY_HMAC_KEYS_JSON',
      !hrOperationsHmacKeys[hrOperationsHmacActiveVersion] &&
        'HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS_JSON',
    ].filter(Boolean);

    if (missingActiveKeys.length > 0) {
      throw new EnvironmentValidationError(
        `${missingActiveKeys.join(', ')} must include their active key versions in production.`,
      );
    }
  }

  return {
    PROJECTS_REMINDERS_ENABLED: projectsRemindersEnabled,
    PROJECTS_IDEMPOTENCY_HMAC_ACTIVE_VERSION: projectsHmacActiveVersion,
    PROJECTS_IDEMPOTENCY_HMAC_KEYS: projectsHmacKeys,
    HR_OPERATIONS_IDEMPOTENCY_HMAC_ACTIVE_VERSION:
      hrOperationsHmacActiveVersion,
    HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS: hrOperationsHmacKeys,
    FINANCE_IDEMPOTENCY_HMAC_ACTIVE_VERSION: financeHmacActiveVersion,
    FINANCE_IDEMPOTENCY_HMAC_KEYS: financeHmacKeys,
    PAYROLL_IDEMPOTENCY_HMAC_ACTIVE_VERSION: payrollHmacActiveVersion,
    PAYROLL_IDEMPOTENCY_HMAC_KEYS: payrollHmacKeys,
    FINANCE_BANK_REFERENCE_ENC_ACTIVE_VERSION: financeBankEncActiveVersion,
    FINANCE_BANK_REFERENCE_ENC_KEYS: financeBankEncKeys,
  };
}

function readFileStorageSettings(
  config: Record<string, unknown>,
  nodeEnvironment: Environment['NODE_ENV'],
) {
  const scanWorkerEnabled = readBoolean(
    config,
    'FILE_SCAN_WORKER_ENABLED',
    false,
  );
  const signedOfferEnabled = readBoolean(
    config,
    'SIGNED_OFFER_VERIFICATION_ENABLED',
    false,
  );
  const retentionPurgeEnabled = readBoolean(
    config,
    'FILE_RETENTION_PURGE_ENABLED',
    false,
  );

  let encryptionKeys: Record<string, Buffer> = {};
  try {
    encryptionKeys = parseFileNameEncryptionKeys(
      readOptionalString(config, 'FILE_NAME_ENC_KEYS_JSON'),
    );
  } catch (error) {
    throw new EnvironmentValidationError(
      error instanceof Error
        ? error.message
        : 'FILE_NAME_ENC_KEYS_JSON is invalid.',
    );
  }

  const activeKeyVersion =
    readOptionalString(config, 'FILE_NAME_ENC_ACTIVE_KEY_VERSION') ?? 'v1';
  const acceptedKeyVersions = (
    readOptionalString(config, 'FILE_NAME_ENC_ACCEPTED_KEY_VERSIONS') ??
    activeKeyVersion
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const storageBucket = readOptionalString(config, 'STORAGE_S3_BUCKET');
  const storageRegion = readOptionalString(config, 'STORAGE_S3_REGION');
  const clamAvHost = readOptionalString(config, 'CLAMAV_HOST');
  const secureStorageRequired =
    nodeEnvironment === 'production' ||
    scanWorkerEnabled ||
    signedOfferEnabled ||
    retentionPurgeEnabled;

  if (secureStorageRequired) {
    if (!storageBucket) {
      throw new EnvironmentValidationError(
        'STORAGE_S3_BUCKET is required for secure file operations.',
      );
    }
    if (!encryptionKeys[activeKeyVersion]) {
      throw new EnvironmentValidationError(
        'FILE_NAME_ENC_KEYS_JSON must include the active key version for secure file operations.',
      );
    }
  }

  if (storageBucket && !storageRegion) {
    throw new EnvironmentValidationError(
      'STORAGE_S3_REGION is required when STORAGE_S3_BUCKET is configured.',
    );
  }

  if (scanWorkerEnabled) {
    if (!clamAvHost) {
      throw new EnvironmentValidationError(
        'CLAMAV_HOST is required when FILE_SCAN_WORKER_ENABLED is true.',
      );
    }
  }

  for (const version of acceptedKeyVersions) {
    if (secureStorageRequired && !encryptionKeys[version]) {
      throw new EnvironmentValidationError(
        `FILE_NAME_ENC_KEYS_JSON must include accepted version ${version}.`,
      );
    }
  }

  return {
    STORAGE_S3_REGION: storageRegion,
    STORAGE_S3_BUCKET: storageBucket,
    STORAGE_S3_ENDPOINT: readOptionalString(config, 'STORAGE_S3_ENDPOINT'),
    STORAGE_S3_ACCESS_KEY_ID: readOptionalString(
      config,
      'STORAGE_S3_ACCESS_KEY_ID',
    ),
    STORAGE_S3_SECRET_ACCESS_KEY: readOptionalString(
      config,
      'STORAGE_S3_SECRET_ACCESS_KEY',
    ),
    STORAGE_PRESIGNED_PUT_TTL_SECONDS: readInteger(
      config,
      'STORAGE_PRESIGNED_PUT_TTL_SECONDS',
      900,
      60,
      3_600,
    ),
    STORAGE_PRESIGNED_GET_TTL_SECONDS: readInteger(
      config,
      'STORAGE_PRESIGNED_GET_TTL_SECONDS',
      300,
      60,
      3_600,
    ),
    FILE_SCAN_WORKER_ENABLED: scanWorkerEnabled,
    SIGNED_OFFER_VERIFICATION_ENABLED: signedOfferEnabled,
    FILE_RETENTION_PURGE_ENABLED: retentionPurgeEnabled,
    FILE_NAME_ENC_ACTIVE_KEY_VERSION: activeKeyVersion,
    FILE_NAME_ENC_ACCEPTED_KEY_VERSIONS: acceptedKeyVersions,
    FILE_NAME_ENC_KEYS: encryptionKeys,
  };
}

function readAssetSecuritySettings(
  config: Record<string, unknown>,
  nodeEnvironment: Environment['NODE_ENV'],
) {
  const cardKek = readOptionalString(config, 'ASSET_CARD_KEK');

  if (nodeEnvironment === 'production' && !isAssetCardKekConfigured(cardKek)) {
    throw new EnvironmentValidationError(
      'ASSET_CARD_KEK must contain a valid 32-byte key in production.',
    );
  }

  let hmacKeys: Record<string, Buffer> = {};
  try {
    hmacKeys = parseAssetIdempotencyHmacKeys(
      readOptionalString(config, 'ASSET_IDEMPOTENCY_HMAC_KEYS_JSON'),
    );
  } catch (error) {
    throw new EnvironmentValidationError(
      error instanceof Error
        ? error.message
        : 'ASSET_IDEMPOTENCY_HMAC_KEYS_JSON is invalid.',
    );
  }

  const hmacActiveVersion =
    readOptionalString(config, 'ASSET_IDEMPOTENCY_HMAC_ACTIVE_VERSION') ?? 'v1';

  if (nodeEnvironment === 'production') {
    const activeKey = hmacKeys[hmacActiveVersion];
    if (!activeKey) {
      throw new EnvironmentValidationError(
        'ASSET_IDEMPOTENCY_HMAC_KEYS_JSON must include the active key version in production.',
      );
    }
  }

  return {
    ASSET_CARD_KEK: cardKek,
    ASSET_IDEMPOTENCY_HMAC_ACTIVE_VERSION: hmacActiveVersion,
    ASSET_IDEMPOTENCY_HMAC_KEYS: hmacKeys,
  };
}

export function resolveLogLevels(level: LogLevel): LogLevel[] {
  const orderedLevels: LogLevel[] = [
    'fatal',
    'error',
    'warn',
    'log',
    'debug',
    'verbose',
  ];
  const thresholdIndex = orderedLevels.indexOf(level);

  return orderedLevels.slice(0, thresholdIndex + 1);
}
