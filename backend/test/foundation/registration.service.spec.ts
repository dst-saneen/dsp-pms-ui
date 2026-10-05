import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  PendingRegistration,
  RegistrationType,
  RoleScope,
} from '@prisma/client';
import { createHash } from 'node:crypto';

import { RegistrationService } from '../../src/modules/auth/registration.service';

const hashToken = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const config = {
  get: jest.fn(),
  getOrThrow: jest.fn((key: string) => {
    const values: Record<string, boolean | number> = {
      SAAS_SELF_REGISTRATION_ENABLED: true,
      PUBLIC_CAREERS_ENABLED: true,
      EMAIL_VERIFICATION_CODE_TTL_SECONDS: 600,
      EMAIL_VERIFICATION_MAX_ATTEMPTS: 5,
      EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: 60,
    };

    return values[key];
  }),
};

const passwords = {
  hashPassword: jest.fn((value: string) =>
    Promise.resolve(`password:${value}`),
  ),
  hashToken: jest.fn(hashToken),
  hashMetadata: jest.fn((value?: string) =>
    value ? hashToken(`metadata:${value}`) : undefined,
  ),
};

const redis = {
  incrementWithExpiry: jest.fn().mockResolvedValue(1),
};

const metadata = {
  ip: '127.0.0.1',
  userAgent: 'foundation-test',
};

const pendingRegistration = (
  overrides: Partial<PendingRegistration> = {},
): PendingRegistration => ({
  id: '11111111-1111-4111-8111-111111111111',
  type: RegistrationType.ORGANIZATION_OWNER,
  organizationName: 'Acme Holdings',
  legalCountryCode: 'IN',
  displayName: 'Avery Owner',
  email: 'owner@acme.test',
  normalizedEmail: 'owner@acme.test',
  passwordHash: 'password:StrongPassword123!',
  otpHash: hashToken(
    'email-verification:ORGANIZATION_OWNER:owner@acme.test:123456',
  ),
  otpExpiresAt: new Date(Date.now() + 600_000),
  failedAttempts: 0,
  resendAvailableAt: new Date(Date.now() - 1_000),
  consumedAt: null,
  ipHash: null,
  userAgentHash: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

function createService(input?: {
  prisma?: Record<string, unknown>;
  mail?: Record<string, unknown>;
  auth?: Record<string, unknown>;
}) {
  const pendingCreate = jest.fn(
    ({ data }: { data: Partial<PendingRegistration> }) =>
      Promise.resolve(
        pendingRegistration({
          ...data,
          id: '11111111-1111-4111-8111-111111111111',
        }),
      ),
  );
  const prisma = input?.prisma ?? {
    user: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    pendingRegistration: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: pendingCreate,
    },
    securityEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
  };
  const mail = input?.mail ?? {
    isAvailable: jest.fn().mockReturnValue(true),
    isDevelopmentBypass: jest.fn().mockReturnValue(true),
    sendVerificationCode: jest.fn().mockResolvedValue('BYPASSED'),
  };
  const auth = input?.auth ?? {
    createAuthenticatedSession: jest.fn(),
  };

  return {
    service: new RegistrationService(
      prisma as never,
      auth as never,
      mail as never,
      passwords as never,
      redis as never,
      config as never,
    ),
    prisma,
    mail,
    auth,
    pendingCreate,
  };
}

describe('RegistrationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redis.incrementWithExpiry.mockResolvedValue(1);
  });

  it('stores only an HMAC hash and returns the code only in development bypass', async () => {
    const { service, pendingCreate } = createService();

    const response = await service.startOrganization(
      {
        organizationName: 'Acme Holdings',
        legalCountryCode: 'IN',
        displayName: 'Avery Owner',
        email: 'Owner@Acme.test',
        password: 'StrongPassword123!',
      },
      metadata,
    );

    const storedHash = pendingCreate.mock.calls[0]?.[0].data.otpHash;

    expect(response.developmentVerificationCode).toMatch(/^\d{6}$/);
    expect(storedHash).not.toBe(response.developmentVerificationCode);
    expect(storedHash).toHaveLength(64);
    expect(response.maskedEmail).toBe('Ow***@Acme.test');
  });

  it('keeps a resumable challenge when SMTP delivery fails', async () => {
    const mail = {
      isAvailable: jest.fn().mockReturnValue(true),
      isDevelopmentBypass: jest.fn().mockReturnValue(false),
      sendVerificationCode: jest
        .fn()
        .mockRejectedValue(
          new ServiceUnavailableException('Email unavailable'),
        ),
    };
    const { service } = createService({ mail });

    const response = await service.startOrganization(
      {
        organizationName: 'Acme Holdings',
        legalCountryCode: 'IN',
        displayName: 'Avery Owner',
        email: 'owner@acme.test',
        password: 'StrongPassword123!',
      },
      metadata,
    );

    expect(response).toMatchObject({
      registrationId: '11111111-1111-4111-8111-111111111111',
      deliveryStatus: 'FAILED',
    });
    expect(response.developmentVerificationCode).toBeUndefined();
  });

  it('expires codes and locks verification after the configured attempts', async () => {
    const expiredPrisma = {
      pendingRegistration: {
        findFirst: jest.fn().mockResolvedValue(
          pendingRegistration({
            otpExpiresAt: new Date(Date.now() - 1_000),
          }),
        ),
      },
    };
    const expired = createService({ prisma: expiredPrisma }).service;

    await expect(
      expired.verifyOrganization(
        '11111111-1111-4111-8111-111111111111',
        '123456',
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const exhaustedPrisma = {
      pendingRegistration: {
        findFirst: jest.fn().mockResolvedValue(
          pendingRegistration({
            failedAttempts: 5,
          }),
        ),
      },
    };
    const exhausted = createService({ prisma: exhaustedPrisma }).service;

    await expect(
      exhausted.verifyOrganization(
        '11111111-1111-4111-8111-111111111111',
        '123456',
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('increments failed attempts without storing the supplied invalid code', async () => {
    const updateMany = jest.fn(
      (input: {
        data: {
          failedAttempts?: { increment: number };
          otpHash?: string;
        };
      }) => {
        void input;
        return Promise.resolve({ count: 1 });
      },
    );
    const prisma = {
      pendingRegistration: {
        findFirst: jest.fn().mockResolvedValue(pendingRegistration()),
        updateMany,
      },
    };
    const service = createService({ prisma }).service;

    await expect(
      service.verifyOrganization(
        '11111111-1111-4111-8111-111111111111',
        '999999',
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany.mock.calls[0]?.[0].data.failedAttempts).toEqual({
      increment: 1,
    });
    expect(JSON.stringify(updateMany.mock.calls)).not.toContain('999999');
  });

  it('invalidates the previous OTP when resending', async () => {
    const previous = pendingRegistration({
      otpHash: 'previous-otp-hash',
    });
    const updateMany = jest.fn((input: { data: { otpHash: string } }) => {
      void input;
      return Promise.resolve({ count: 1 });
    });
    const prisma = {
      pendingRegistration: {
        findFirst: jest.fn().mockResolvedValue(previous),
        updateMany,
      },
      securityEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };
    const { service } = createService({ prisma });

    const response = await service.resend(previous.id, metadata);
    const replacementHash = updateMany.mock.calls[0]?.[0].data.otpHash;

    expect(response.developmentVerificationCode).toMatch(/^\d{6}$/);
    expect(replacementHash).not.toBe(previous.otpHash);
    expect(replacementHash).not.toBe(response.developmentVerificationCode);
  });

  it('allows only one concurrent verification to provision the tenant', async () => {
    let consumed = false;
    let companyCreateInput: { data: Record<string, unknown> } | undefined;
    const companyCreate = jest.fn(
      (input: { data: Record<string, unknown> }) => {
        companyCreateInput = input;
        return Promise.resolve({ id: 'company-a' });
      },
    );
    const roleAssignmentCreate = jest.fn(
      (input: {
        data: {
          scope: RoleScope;
          scopeKey: string;
          companyGroupId?: string;
        };
      }) => {
        void input;
        return Promise.resolve({ id: 'role-1' });
      },
    );
    const transaction = {
      pendingRegistration: {
        updateMany: jest.fn().mockImplementation(() => {
          if (consumed) return Promise.resolve({ count: 0 });
          consumed = true;
          return Promise.resolve({ count: 1 });
        }),
      },
      role: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'owner-role', isActive: true }),
      },
      companyGroup: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'group-a', groupName: 'Acme Holdings' }),
      },
      company: {
        create: companyCreate,
      },
      user: {
        create: jest.fn().mockResolvedValue({ id: 'owner-user' }),
      },
      userRoleAssignment: {
        create: roleAssignmentCreate,
      },
      organizationOnboarding: {
        create: jest.fn().mockResolvedValue({ id: 'onboarding-1' }),
      },
      securityEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };
    const prisma = {
      pendingRegistration: {
        findFirst: jest.fn().mockResolvedValue(pendingRegistration()),
      },
      $transaction: jest.fn(
        (operation: (client: typeof transaction) => Promise<string>) =>
          operation(transaction),
      ),
    };
    const auth = {
      createAuthenticatedSession: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
    };
    const service = createService({ prisma, auth }).service;

    const results = await Promise.allSettled([
      service.verifyOrganization(
        '11111111-1111-4111-8111-111111111111',
        '123456',
        metadata,
      ),
      service.verifyOrganization(
        '11111111-1111-4111-8111-111111111111',
        '123456',
        metadata,
      ),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status).toBe('rejected');
    const rejectionReason = (
      rejected?.status === 'rejected' ? rejected.reason : undefined
    ) as unknown;
    expect(rejectionReason).toBeInstanceOf(ConflictException);
    expect(transaction.companyGroup.create).toHaveBeenCalledTimes(1);
    expect(companyCreate).toHaveBeenCalledTimes(1);
    expect(companyCreateInput).toMatchObject({
      data: {
        companyName: 'Acme Holdings',
        legalCountryCode: 'IN',
      },
    });
    expect(roleAssignmentCreate.mock.calls[0]?.[0].data).toMatchObject({
      scope: RoleScope.COMPANY_GROUP,
      scopeKey: 'COMPANY_GROUP:group-a',
      companyGroupId: 'group-a',
    });
    expect(auth.createAuthenticatedSession).toHaveBeenCalledTimes(1);
    expect(transaction.organizationOnboarding.create).toHaveBeenCalledWith({
      data: {
        companyGroupId: 'group-a',
        ownerUserId: 'owner-user',
        status: 'IN_PROGRESS',
        currentStep: 'ORGANIZATION',
      },
    });
  });

  it('never exposes public platform setup capability', () => {
    const service = createService().service;

    expect(service.capabilities()).toEqual({
      selfRegistrationEnabled: true,
      publicCareersEnabled: true,
      platformSetupAvailable: false,
    });
  });

  it('does not authenticate when tenant provisioning fails', async () => {
    const transaction = {
      pendingRegistration: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      role: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'owner-role', isActive: true }),
      },
      companyGroup: {
        create: jest.fn().mockResolvedValue({ id: 'group-a' }),
      },
      company: {
        create: jest.fn().mockRejectedValue(new Error('provisioning failed')),
      },
    };
    const prisma = {
      pendingRegistration: {
        findFirst: jest.fn().mockResolvedValue(pendingRegistration()),
      },
      $transaction: jest.fn(
        (operation: (client: typeof transaction) => Promise<string>) =>
          operation(transaction),
      ),
    };
    const auth = {
      createAuthenticatedSession: jest.fn(),
    };
    const service = createService({ prisma, auth }).service;

    await expect(
      service.verifyOrganization(
        '11111111-1111-4111-8111-111111111111',
        '123456',
        metadata,
      ),
    ).rejects.toThrow('provisioning failed');
    expect(auth.createAuthenticatedSession).not.toHaveBeenCalled();
  });
});
