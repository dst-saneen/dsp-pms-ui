import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  EnvironmentValidationError,
  validateEnvironment,
} from '../../src/config';

describe('environment validation', () => {
  const validEnvironment = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test-user:test-password@localhost:5432/test-db',
    DATABASE_SCHEMA: 'dsp_pms',
  };
  const keyMaterial = '0'.repeat(64);
  const versionedKeyJson = JSON.stringify({ v1: keyMaterial });

  const retiredTenantRolloutValues = {
    ASSET_V2_ENABLED: 'false',
    ASSET_V2_SCOPE_ALLOWLIST_JSON: JSON.stringify([
      { companyId: 'company-qa', branchIds: ['branch-qa'] },
    ]),
    ASSET_LEGACY_DELETE_ALIAS_ENABLED: 'true',
    DELIVERY_V2_ENABLED: 'false',
    DELIVERY_V2_ALLOWLIST_JSON: JSON.stringify([{ companyId: 'company-qa' }]),
    FILE_STORAGE_V2_ENABLED: 'false',
    FILE_STORAGE_SCOPE_ALLOWLIST_JSON: JSON.stringify([
      { companyId: 'company-qa' },
    ]),
    OFFICE_FINANCE_LITE_ENABLED: 'false',
    OFFICE_FINANCE_LITE_COMPANY_IDS: 'company-qa',
    PAYROLL_LITE_ENABLED: 'false',
    PAYROLL_LITE_COMPANY_IDS: 'company-qa',
    PROJECTS_LITE_ENABLED: 'false',
    PROJECTS_LITE_COMPANY_IDS: 'company-qa',
    ONBOARDING_V2_ENABLED: 'false',
    ONBOARDING_V2_COMPANY_IDS: 'company-qa',
    ONBOARDING_V2_BRANCH_IDS: 'branch-qa',
    RECRUITMENT_ENABLED: 'false',
    RECRUITMENT_SHORTLIST_ENABLED: 'false',
  };

  const validProductionEnvironment = {
    ...validEnvironment,
    NODE_ENV: 'production',
    AUTH_HASH_SECRET_PATH: 'package.json',
    AUTH_ACTION_TOKEN_SECRET_PATH: 'tsconfig.json',
    STORAGE_S3_PREFIX: 'dsp-pms-production',
    STORAGE_S3_BUCKET: 'dsp-pms-production-files',
    STORAGE_S3_REGION: 'eu-west-1',
    FILE_NAME_ENC_ACTIVE_KEY_VERSION: 'v1',
    FILE_NAME_ENC_KEYS_JSON: versionedKeyJson,
    ASSET_CARD_KEK: keyMaterial,
    ASSET_IDEMPOTENCY_HMAC_ACTIVE_VERSION: 'v1',
    ASSET_IDEMPOTENCY_HMAC_KEYS_JSON: versionedKeyJson,
    DELIVERY_CONTENT_ENCRYPTION_ACTIVE_VERSION: 'v1',
    DELIVERY_CONTENT_ENCRYPTION_KEYS_JSON: versionedKeyJson,
    DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION: 'v1',
    DELIVERY_ADDRESS_HMAC_KEYS_JSON: versionedKeyJson,
    DELIVERY_COMMAND_RECEIPT_HMAC_ACTIVE_VERSION: 'v1',
    DELIVERY_COMMAND_RECEIPT_HMAC_KEYS_JSON: versionedKeyJson,
    PROJECTS_IDEMPOTENCY_HMAC_ACTIVE_VERSION: 'v1',
    PROJECTS_IDEMPOTENCY_HMAC_KEYS_JSON: versionedKeyJson,
    HR_OPERATIONS_IDEMPOTENCY_HMAC_ACTIVE_VERSION: 'v1',
    HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS_JSON: versionedKeyJson,
    FINANCE_IDEMPOTENCY_HMAC_ACTIVE_VERSION: 'v1',
    FINANCE_IDEMPOTENCY_HMAC_KEYS_JSON: versionedKeyJson,
    PAYROLL_IDEMPOTENCY_HMAC_ACTIVE_VERSION: 'v1',
    PAYROLL_IDEMPOTENCY_HMAC_KEYS_JSON: versionedKeyJson,
    FINANCE_BANK_REFERENCE_ENC_ACTIVE_VERSION: 'v1',
    FINANCE_BANK_REFERENCE_ENC_KEYS_JSON: versionedKeyJson,
  };

  it('keeps the committed application template boot-valid', () => {
    const example = parse(
      readFileSync(resolve(process.cwd(), '.env.example'), 'utf8'),
    );

    expect(() =>
      validateEnvironment({
        ...example,
        NODE_ENV: 'test',
        DATABASE_URL: validEnvironment.DATABASE_URL,
      }),
    ).not.toThrow();
  });

  it('keeps the application template neutral to a current schema, email host, and storage region', () => {
    const example = parse(
      readFileSync(resolve(process.cwd(), '.env.example'), 'utf8'),
    );

    expect(example.DATABASE_SCHEMA).not.toBe('dsp_pms');
    expect(example).not.toHaveProperty('EMAIL_PROVIDER');
    expect(example).not.toHaveProperty('ZEPTOMAIL_SEND_TOKEN');
    expect(example).not.toHaveProperty('ZEPTOMAIL_WEBHOOK_SECRET');
    expect(example.SMTP_HOST).toBe('');
    expect(example.SMTP_USERNAME).toBe('');
    expect(example.STORAGE_S3_REGION).toBe('');
  });

  it('does not expose unknown process variables through validated config', () => {
    const result = validateEnvironment({
      ...validEnvironment,
      OBSOLETE_TENANT_ROLLOUT: 'company-id',
    });

    expect(result).not.toHaveProperty('OBSOLETE_TENANT_ROLLOUT');
  });

  it('ignores retired tenant rollout values and never exposes them', () => {
    const result = validateEnvironment({
      ...validEnvironment,
      ...retiredTenantRolloutValues,
    });

    for (const key of Object.keys(retiredTenantRolloutValues)) {
      expect(result).not.toHaveProperty(key);
    }
  });

  it('applies the approved reliability defaults', () => {
    const result = validateEnvironment(validEnvironment);

    expect(result).toMatchObject({
      HOST: '0.0.0.0',
      PORT: 4500,
      FRONTEND_URL: 'http://localhost:3200',
      CORS_ORIGINS: ['http://localhost:3200'],
      LOG_LEVEL: 'log',
      DATABASE_POOL_SIZE: 20,
      DATABASE_CONNECTION_TIMEOUT_MS: 10_000,
      DATABASE_IDLE_TIMEOUT_MS: 30_000,
      DATABASE_QUERY_TIMEOUT_MS: 30_000,
      DATABASE_STATEMENT_TIMEOUT_MS: 30_000,
      DATABASE_LOCK_TIMEOUT_MS: 5_000,
      DATABASE_IDLE_TRANSACTION_TIMEOUT_MS: 30_000,
      DATABASE_MAX_LIFETIME_SECONDS: 1_800,
      DATABASE_CONNECT_RETRIES: 3,
      DATABASE_CONNECT_RETRY_DELAY_MS: 1_000,
      DATABASE_HEALTH_TIMEOUT_MS: 3_000,
      AUTH_ACCESS_TOKEN_TTL_SECONDS: 600,
      AUTH_SESSION_IDLE_TTL_SECONDS: 1_800,
      AUTH_SESSION_ABSOLUTE_TTL_SECONDS: 43_200,
      AUTH_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS: 300,
      AUTH_ACTION_TOKEN_SECRET_PATH: 'certs/auth-hash-secret',
      AUTH_INVITATION_TTL_SECONDS: 86_400,
      AUTH_PASSWORD_RESET_TTL_SECONDS: 1_800,
      AUTH_ACTION_RESEND_COOLDOWN_SECONDS: 60,
      SAAS_SELF_REGISTRATION_ENABLED: false,
      EMAIL_ENABLED: false,
      SMTP_PORT: 587,
      EMAIL_CONNECTION_TIMEOUT_MS: 10_000,
      EMAIL_SEND_TIMEOUT_MS: 30_000,
      EMAIL_VERIFICATION_CODE_TTL_SECONDS: 600,
      EMAIL_VERIFICATION_MAX_ATTEMPTS: 5,
      EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: 60,
      EMAIL_DEV_BYPASS: false,
      REDIS_ENABLED: true,
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6_379,
      REDIS_CACHE_TTL: 60,
      REDIS_COMMAND_TIMEOUT_MS: 200,
      WORKFORCE_JOBS_ENABLED: false,
      WORKFORCE_JOB_BATCH_SIZE: 100,
      ATTENDANCE_FINALIZER_INTERVAL_MINUTES: 15,
      WORKFORCE_OUTBOX_LOCK_TIMEOUT_SECONDS: 300,
      STORAGE_S3_PREFIX: 'test',
    });
  });

  it('parses and validates multiple CORS origins', () => {
    const result = validateEnvironment({
      ...validEnvironment,
      CORS_ORIGINS: 'http://localhost:3200,https://erp.example.test',
    });

    expect(result.CORS_ORIGINS).toEqual([
      'http://localhost:3200',
      'https://erp.example.test',
    ]);
  });

  it('fails without exposing an invalid database value', () => {
    const secretValue = 'postgresql://user:super-secret@';

    expect.assertions(2);

    try {
      validateEnvironment({
        ...validEnvironment,
        DATABASE_URL: secretValue,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvironmentValidationError);
      expect((error as Error).message).not.toContain('super-secret');
    }
  });

  it('fails when a configured CA file cannot be read', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        DATABASE_SSL_CA: 'certs/missing-foundation-test.pem',
      }),
    ).toThrow('DATABASE_SSL_CA must point to a readable certificate file.');
  });

  it('rejects the email development bypass in production', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        EMAIL_DEV_BYPASS: 'true',
      }),
    ).toThrow('EMAIL_DEV_BYPASS cannot be enabled in production.');
  });

  it('requires an explicit storage prefix in production', () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        STORAGE_S3_PREFIX: '',
      }),
    ).toThrow('STORAGE_S3_PREFIX is required in production');
  });

  it('rejects unsafe storage prefixes', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        STORAGE_S3_PREFIX: '../shared',
      }),
    ).toThrow('STORAGE_S3_PREFIX must be 1-63 lowercase');
  });

  it('rejects development and test storage namespaces in production', () => {
    expect(() =>
      validateEnvironment({
        ...validProductionEnvironment,
        STORAGE_S3_PREFIX: 'development',
      }),
    ).toThrow('STORAGE_S3_PREFIX must identify the production deployment');
  });

  it('requires production storage and cryptographic controls regardless of retired company IDs', () => {
    const productionWithRetiredRollouts = {
      ...validProductionEnvironment,
      ...retiredTenantRolloutValues,
    };

    expect(() =>
      validateEnvironment(productionWithRetiredRollouts),
    ).not.toThrow();

    const requiredSettings: Array<[string, RegExp]> = [
      ['STORAGE_S3_BUCKET', /STORAGE_S3_BUCKET is required/],
      ['STORAGE_S3_REGION', /STORAGE_S3_REGION is required/],
      [
        'FILE_NAME_ENC_KEYS_JSON',
        /FILE_NAME_ENC_KEYS_JSON must include the active key version/,
      ],
      ['ASSET_CARD_KEK', /ASSET_CARD_KEK must contain a valid 32-byte key/],
      [
        'ASSET_IDEMPOTENCY_HMAC_KEYS_JSON',
        /ASSET_IDEMPOTENCY_HMAC_KEYS_JSON must include the active key version/,
      ],
      [
        'DELIVERY_CONTENT_ENCRYPTION_KEYS_JSON',
        /DELIVERY_CONTENT_ENCRYPTION_KEYS_JSON must include the active key version/,
      ],
      [
        'DELIVERY_ADDRESS_HMAC_KEYS_JSON',
        /DELIVERY_ADDRESS_HMAC_KEYS_JSON must include the active key version/,
      ],
      [
        'DELIVERY_COMMAND_RECEIPT_HMAC_KEYS_JSON',
        /DELIVERY_COMMAND_RECEIPT_HMAC_KEYS_JSON must include the active key version/,
      ],
      [
        'FINANCE_IDEMPOTENCY_HMAC_KEYS_JSON',
        /FINANCE_IDEMPOTENCY_HMAC_KEYS_JSON must include their active key versions/,
      ],
      [
        'FINANCE_BANK_REFERENCE_ENC_KEYS_JSON',
        /FINANCE_BANK_REFERENCE_ENC_KEYS_JSON must include their active key versions/,
      ],
      [
        'PAYROLL_IDEMPOTENCY_HMAC_KEYS_JSON',
        /PAYROLL_IDEMPOTENCY_HMAC_KEYS_JSON must include their active key versions/,
      ],
      [
        'PROJECTS_IDEMPOTENCY_HMAC_KEYS_JSON',
        /PROJECTS_IDEMPOTENCY_HMAC_KEYS_JSON must include their active key versions/,
      ],
      [
        'HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS_JSON',
        /HR_OPERATIONS_IDEMPOTENCY_HMAC_KEYS_JSON must include their active key versions/,
      ],
    ];

    for (const [key, message] of requiredSettings) {
      const config = { ...productionWithRetiredRollouts };
      delete config[key];

      expect(() => validateEnvironment(config)).toThrow(message);
    }
  });

  it('requires email delivery for production self-registration', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        NODE_ENV: 'production',
        SAAS_SELF_REGISTRATION_ENABLED: 'true',
        EMAIL_ENABLED: 'false',
      }),
    ).toThrow(
      'EMAIL_ENABLED must be true when production self-registration is enabled.',
    );
  });

  it('requires SMTP credentials whenever email delivery is enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        EMAIL_ENABLED: 'true',
      }),
    ).toThrow(
      'SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_ADDRESS required when email is enabled.',
    );
  });

  it('permits missing provider credentials only with the non-production bypass', () => {
    const result = validateEnvironment({
      ...validEnvironment,
      EMAIL_ENABLED: 'true',
      EMAIL_DEV_BYPASS: 'true',
    });

    expect(result).toMatchObject({
      EMAIL_ENABLED: true,
      EMAIL_DEV_BYPASS: true,
      SMTP_PORT: 587,
    });
  });

  it('accepts SMTP credentials without ZeptoMail credentials', () => {
    const result = validateEnvironment({
      ...validEnvironment,
      EMAIL_ENABLED: 'true',
      SMTP_HOST: 'smtp.zeptomail.in',
      SMTP_PORT: '587',
      SMTP_USERNAME: 'emailapikey',
      SMTP_PASSWORD: 'send-mail-token',
      SMTP_FROM_ADDRESS: 'noreply@example.com',
      SMTP_REPLY_TO: '',
    });

    expect(result).toMatchObject({
      SMTP_HOST: 'smtp.zeptomail.in',
      SMTP_PORT: 587,
      SMTP_USERNAME: 'emailapikey',
      SMTP_FROM_ADDRESS: 'noreply@example.com',
      SMTP_REPLY_TO: undefined,
    });
  });

  it('ignores retired direct-provider configuration', () => {
    const result = validateEnvironment({
      ...validEnvironment,
      EMAIL_PROVIDER: 'ZEPTOMAIL',
      ZEPTOMAIL_SEND_TOKEN: 'send-mail-token',
      ZEPTOMAIL_FROM_ADDRESS: 'noreply@example.com',
      ZEPTOMAIL_FROM_NAME: 'Group ERP',
      ZEPTOMAIL_WEBHOOK_SECRET: 'webhook-secret',
      ZEPTOMAIL_WEBHOOK_REPLAY_WINDOW_SECONDS: '300',
    });

    expect(result).not.toHaveProperty('EMAIL_PROVIDER');
    expect(result).not.toHaveProperty('ZEPTOMAIL_SEND_TOKEN');
    expect(result).not.toHaveProperty('ZEPTOMAIL_FROM_ADDRESS');
    expect(result).not.toHaveProperty('ZEPTOMAIL_FROM_NAME');
    expect(result).not.toHaveProperty('ZEPTOMAIL_WEBHOOK_SECRET');
    expect(result).not.toHaveProperty(
      'ZEPTOMAIL_WEBHOOK_REPLAY_WINDOW_SECONDS',
    );
  });

  it('allows public careers deployment exposure without a tenant rollout flag', () => {
    const result = validateEnvironment({
      ...validEnvironment,
      ...retiredTenantRolloutValues,
      PUBLIC_CAREERS_ENABLED: 'true',
    });

    expect(result).toMatchObject({ PUBLIC_CAREERS_ENABLED: true });
    expect(result).not.toHaveProperty('RECRUITMENT_ENABLED');
  });
});
