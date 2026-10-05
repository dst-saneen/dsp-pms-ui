import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoleScope } from '@prisma/client';

import type { AuthenticatedUser } from '../../src/modules/auth/auth.types';
import { RoleAdministrationService } from '../../src/modules/auth/role-administration.service';
import { createSessionServiceMock } from './test-mocks';

const actor: AuthenticatedUser = {
  id: 'owner-user',
  username: 'owner',
  mustChangePassword: false,
  sessionId: 'session-1',
  authorization: {
    roles: ['ORGANIZATION_OWNER'],
    permissions: ['security.roles.manage'],
    scopeLevel: RoleScope.COMPANY_GROUP,
    isGlobal: false,
    activeCompanyGroupId: 'group-a',
    activeCompanyId: 'company-a',
    availableScopes: [],
  },
};

function createService(prisma: Record<string, unknown>) {
  const sessions = createSessionServiceMock();
  const numberSeries = {
    next: jest.fn().mockResolvedValue('ROLE-GROUPA-0001'),
  };
  const audit = {
    log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  };
  if (!prisma.$transaction) {
    prisma.$transaction = jest.fn((callback: (tx: unknown) => unknown) =>
      Promise.resolve(callback(prisma)),
    );
  }
  return {
    service: new RoleAdministrationService(
      prisma as never,
      sessions as never,
      numberSeries as never,
      audit as never,
    ),
    sessions,
    audit,
  };
}

describe('RoleAdministrationService', () => {
  it('creates tenant-owned roles from tenant-assignable permissions', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'role-1' });
    const { service, audit } = createService({
      role: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
      permission: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'permission-1', code: 'security.roles.manage' },
          ]),
      },
    });

    await service.create(actor, {
      name: 'Payroll Reviewer',
      permissionIds: ['permission-1'],
    });

    expect(audit.log).toHaveBeenCalledWith(
      'Role',
      'role-1',
      'CREATE',
      undefined,
      expect.objectContaining({
        permissionIds: ['permission-1'],
      }),
      expect.objectContaining({ userId: actor.id }),
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          companyGroupId: 'group-a',
          normalizedName: 'payroll reviewer',
          isSystem: false,
          permissions: {
            create: [{ permissionId: 'permission-1' }],
          },
        }),
      }),
    );
  });

  it('rejects a permission that is not tenant assignable', async () => {
    const { service } = createService({
      role: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      permission: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    });

    await expect(
      service.create(actor, {
        name: 'Unsafe Role',
        permissionIds: ['platform-admin-permission'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents system-role modification', async () => {
    const { service } = createService({
      role: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'system-role',
          isSystem: true,
          companyGroupId: 'group-a',
          normalizedName: null,
        }),
      },
    });

    await expect(
      service.update(actor, 'system-role', { name: 'Changed' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('invalidates assigned-user sessions after permission changes', async () => {
    const transaction = {
      rolePermission: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      role: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'custom-role' }),
      },
      securityEvent: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      role: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'custom-role',
          isSystem: false,
          companyGroupId: 'group-a',
          normalizedName: 'reviewer',
        }),
      },
      permission: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'permission-1', code: 'security.roles.manage' },
          ]),
      },
      userRoleAssignment: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'assigned-user' }]),
      },
      $transaction: jest.fn(
        (callback: (input: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    };
    const { service, sessions, audit } = createService(prisma);

    await service.replacePermissions(actor, 'custom-role', ['permission-1']);

    expect(transaction.user.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['assigned-user'] } },
      data: { securityVersion: { increment: 1 } },
    });
    expect(sessions.revokeAllInTransaction).toHaveBeenCalledWith(
      transaction,
      'assigned-user',
      'ROLE_PERMISSIONS_CHANGED',
    );
    expect(audit.log).toHaveBeenCalledWith(
      'Role',
      'custom-role',
      'UPDATE',
      undefined,
      expect.objectContaining({ action: 'PERMISSIONS_REPLACED' }),
      expect.objectContaining({ userId: actor.id, tx: transaction }),
    );
  });

  it('rejects the mutation when business audit fails', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'role-1' });
    const { service, audit } = createService({
      role: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
      permission: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'permission-1', code: 'security.roles.manage' },
          ]),
      },
    });
    audit.log.mockRejectedValue(new Error('audit unavailable'));

    await expect(
      service.create(actor, {
        name: 'Payroll Reviewer',
        permissionIds: ['permission-1'],
      }),
    ).rejects.toThrow('audit unavailable');
  });
});
