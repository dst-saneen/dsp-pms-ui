import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { createHash } from 'node:crypto';

import { AccountLifecycleService } from '../../src/modules/auth/account-lifecycle.service';
import { createSessionServiceMock } from './test-mocks';

const hashToken = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const config = {
  getOrThrow: jest.fn((key: string) => {
    const values: Record<string, string | number> = {
      FRONTEND_URL: 'http://localhost:3200',
      NODE_ENV: 'test',
      AUTH_INVITATION_TTL_SECONDS: 86_400,
      AUTH_PASSWORD_RESET_TTL_SECONDS: 1_800,
      AUTH_ACTION_RESEND_COOLDOWN_SECONDS: 60,
    };
    return values[key];
  }),
};

const passwords = {
  hashToken: jest.fn(hashToken),
  hashActionToken: jest.fn((purpose: string, value: string) =>
    hashToken(`${purpose}:${value}`),
  ),
  hashPassword: jest.fn((value: string) =>
    Promise.resolve(`password:${value}`),
  ),
  hashMetadata: jest.fn((value?: string) =>
    value ? hashToken(`metadata:${value}`) : undefined,
  ),
};

const mail = {
  isDevelopmentBypass: jest.fn().mockReturnValue(true),
  sendInvitationLink: jest.fn().mockResolvedValue('BYPASSED'),
  sendPasswordResetLink: jest.fn().mockResolvedValue('BYPASSED'),
};

const redis = {
  incrementWithExpiry: jest.fn().mockResolvedValue(1),
};

const sessions = createSessionServiceMock();
const auth = {
  createAuthenticatedSession: jest.fn().mockResolvedValue({
    accessToken: 'access-token',
    expiresIn: 600,
    user: { id: 'user-1' },
    refreshToken: 'refresh-token',
  }),
};
const authorization = {
  getAvailableScopes: jest.fn().mockResolvedValue([
    {
      scope: 'COMPANY',
      companyGroupId: 'group-1',
      companyId: 'company-1',
      companyName: 'Company One',
    },
  ]),
  buildSnapshot: jest.fn().mockResolvedValue({
    activeCompanyGroupId: 'group-1',
    activeCompanyId: 'company-1',
  }),
};

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invitation-1',
    userId: 'user-1',
    companyGroupId: 'group-1',
    invitedByUserId: 'owner-1',
    email: 'person@example.test',
    normalizedEmail: 'person@example.test',
    tokenHash: hashToken('invitation:raw-token'),
    expiresAt: new Date(Date.now() + 60_000),
    resendAvailableAt: new Date(Date.now() - 1_000),
    sentAt: new Date(),
    consumedAt: null,
    revokedAt: null,
    ipHash: null,
    userAgentHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      username: 'person',
      displayName: 'Person Example',
      status: UserStatus.INVITED,
    },
    ...overrides,
  };
}

function createService(prisma: Record<string, unknown>) {
  return new AccountLifecycleService(
    prisma as never,
    passwords as never,
    mail as never,
    redis as never,
    sessions as never,
    auth as never,
    authorization as never,
    config as never,
  );
}

describe('AccountLifecycleService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mail.isDevelopmentBypass.mockReturnValue(true);
    redis.incrementWithExpiry.mockResolvedValue(1);
    sessions.revokeAll.mockResolvedValue(undefined);
    sessions.revokeAllInTransaction.mockResolvedValue([]);
    sessions.invalidateSessionIds.mockResolvedValue(undefined);
    auth.createAuthenticatedSession.mockResolvedValue({
      accessToken: 'access-token',
      expiresIn: 600,
      user: { id: 'user-1' },
      refreshToken: 'refresh-token',
    });
    authorization.getAvailableScopes.mockResolvedValue([
      {
        scope: 'COMPANY',
        companyGroupId: 'group-1',
        companyId: 'company-1',
        companyName: 'Company One',
      },
    ]);
    authorization.buildSnapshot.mockResolvedValue({
      activeCompanyGroupId: 'group-1',
      activeCompanyId: 'company-1',
    });
  });

  it('creates a random invitation token and stores only its domain-separated hash', () => {
    const service = createService({});
    const result = service.prepareInvitation(new Date('2026-07-31T00:00:00Z'));

    expect(result.token).toHaveLength(43);
    expect(result.tokenHash).toBe(hashToken(`invitation:${result.token}`));
    expect(result.tokenHash).not.toContain(result.token);
    expect(result.expiresAt.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('returns masked invitation details without exposing the email or token', async () => {
    const service = createService({
      userInvitation: {
        findUnique: jest.fn().mockResolvedValue(invitation()),
      },
    });

    const result = await service.inspectInvitation('raw-token');

    expect(result).toEqual({
      status: 'VALID',
      displayName: 'Person Example',
      maskedEmail: 'pe****@example.test',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expiresAt: expect.any(Date),
      passwordPolicy: {
        minimumLength: 12,
        maximumLength: 128,
        mustDifferFromEmailOrUsername: true,
      },
    });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('token');
  });

  it('rejects an expired invitation before changing the user', async () => {
    const service = createService({
      userInvitation: {
        findUnique: jest.fn().mockResolvedValue(
          invitation({
            expiresAt: new Date(Date.now() - 1_000),
          }),
        ),
      },
    });

    await expect(service.inspectInvitation('raw-token')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requires an explicit scope when an invitation has multiple valid workspaces and no default', async () => {
    authorization.getAvailableScopes.mockResolvedValue([
      {
        scope: 'COMPANY',
        companyGroupId: 'group-1',
        companyId: 'company-1',
        companyName: 'Company One',
      },
      {
        scope: 'COMPANY',
        companyGroupId: 'group-1',
        companyId: 'company-2',
        companyName: 'Company Two',
      },
    ]);
    const service = createService({
      userInvitation: {
        findUnique: jest.fn().mockResolvedValue(invitation()),
      },
    });

    await expect(service.inspectInvitation('raw-token')).resolves.toMatchObject(
      {
        scopeSelectionRequired: true,
        availableScopes: [
          { companyId: 'company-1' },
          { companyId: 'company-2' },
        ],
      },
    );
  });

  it('preserves a valid persisted default when an invitation has multiple workspaces', async () => {
    authorization.getAvailableScopes.mockResolvedValue([
      {
        scope: 'COMPANY',
        companyGroupId: 'group-1',
        companyId: 'company-1',
        companyName: 'Company One',
      },
      {
        scope: 'COMPANY',
        companyGroupId: 'group-1',
        companyId: 'company-2',
        companyName: 'Company Two',
      },
    ]);
    const service = createService({
      userInvitation: {
        findUnique: jest.fn().mockResolvedValue(
          invitation({
            user: {
              username: 'person',
              displayName: 'Person Example',
              status: UserStatus.INVITED,
              defaultCompanyGroupId: 'group-1',
              defaultCompanyId: 'company-2',
              defaultBranchId: null,
            },
          }),
        ),
      },
    });

    const result = await service.inspectInvitation('raw-token');

    expect(result).not.toHaveProperty('scopeSelectionRequired');
    expect(result).not.toHaveProperty('availableScopes');
  });

  it('does not consume an ambiguous invitation before scope selection', async () => {
    authorization.buildSnapshot.mockRejectedValue(
      new ConflictException({
        code: 'ORGANIZATION_SCOPE_SELECTION_REQUIRED',
        message: 'Select an organization scope to continue.',
      }),
    );
    const transaction = jest.fn();
    const service = createService({
      userInvitation: {
        findUnique: jest.fn().mockResolvedValue(invitation()),
      },
      $transaction: transaction,
    });

    await expect(
      service.acceptInvitation('raw-token', 'StrongPassword123!', {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).not.toHaveBeenCalled();
    expect(passwords.hashPassword).not.toHaveBeenCalled();
  });

  it('activates an invited user once and revokes any existing sessions', async () => {
    const transaction = {
      userInvitation: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      securityEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };
    const prisma = {
      userInvitation: {
        findUnique: jest.fn().mockResolvedValue(invitation()),
      },
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.acceptInvitation('raw-token', 'StrongPassword123!', {
        ip: '127.0.0.1',
      }),
    ).resolves.toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    expect(transaction.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1', status: UserStatus.INVITED },
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          passwordHash: 'password:StrongPassword123!',
          status: UserStatus.ACTIVE,
          securityVersion: { increment: 1 },
        }),
      }),
    );
    expect(sessions.revokeAllInTransaction).toHaveBeenCalledWith(
      transaction,
      'user-1',
      'INVITATION_ACCEPTED',
    );
    expect(sessions.invalidateSessionIds).toHaveBeenCalledWith([]);
    expect(auth.createAuthenticatedSession).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ ip: '127.0.0.1' }),
    );
  });

  it('fails safely when another request consumes the invitation first', async () => {
    const transaction = {
      userInvitation: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = createService({
      userInvitation: {
        findUnique: jest.fn().mockResolvedValue(invitation()),
      },
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    });

    await expect(
      service.acceptInvitation('raw-token', 'StrongPassword123!', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses the explicitly selected invitation scope for the created session', async () => {
    const transaction = {
      userInvitation: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      securityEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };
    const service = createService({
      userInvitation: {
        findUnique: jest.fn().mockResolvedValue(invitation()),
      },
      $transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    });
    const selectedScope = {
      companyGroupId: 'group-1',
      companyId: 'company-2',
      branchId: 'branch-2',
    };

    await service.acceptInvitation(
      'raw-token',
      'StrongPassword123!',
      {},
      selectedScope,
    );

    expect(authorization.buildSnapshot).toHaveBeenCalledWith(
      'user-1',
      'company-2',
      'branch-2',
      'group-1',
    );
    expect(auth.createAuthenticatedSession).toHaveBeenCalledWith(
      'user-1',
      {},
      selectedScope,
    );
  });

  it('returns the same password-reset response when no account exists', async () => {
    const challengeCreate = jest.fn();
    const service = createService({
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      passwordResetChallenge: {
        create: challengeCreate,
      },
    });

    await expect(
      service.requestPasswordReset('unknown@example.test', {}),
    ).resolves.toEqual({
      accepted: true,
      message:
        'If an eligible account exists, password reset instructions will be sent.',
    });
    expect(challengeCreate).not.toHaveBeenCalled();
  });

  it('consumes a password-reset token and revokes all prior sessions', async () => {
    const transaction = {
      passwordResetChallenge: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      securityEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'person@example.test',
          username: 'person',
        }),
      },
      passwordResetChallenge: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reset-1',
          userId: 'user-1',
          expiresAt: new Date(Date.now() + 60_000),
          consumedAt: null,
          revokedAt: null,
        }),
      },
      $transaction: jest.fn(
        (callback: (input: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.resetPassword('reset-token', 'NewStrongPassword123!', {}),
    ).resolves.toEqual({ reset: true });

    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        passwordHash: 'password:NewStrongPassword123!',
        status: UserStatus.ACTIVE,
        securityVersion: { increment: 1 },
      }),
    });
    expect(sessions.revokeAllInTransaction).toHaveBeenCalledWith(
      transaction,
      'user-1',
      'PASSWORD_RESET_COMPLETED',
    );
  });

  it('rejects a reset token that was already consumed', async () => {
    const service = createService({
      passwordResetChallenge: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'reset-1',
          userId: 'user-1',
          expiresAt: new Date(Date.now() + 60_000),
          consumedAt: new Date(),
          revokedAt: null,
        }),
      },
    });

    await expect(
      service.resetPassword('reset-token', 'NewStrongPassword123!', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
