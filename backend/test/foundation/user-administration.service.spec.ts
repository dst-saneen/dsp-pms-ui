import { ForbiddenException } from '@nestjs/common';
import { RoleScope, UserStatus } from '@prisma/client';

import { UserAdministrationService } from '../../src/modules/auth/user-administration.service';
import type { AuthenticatedUser } from '../../src/modules/auth/auth.types';
import { createSessionServiceMock } from './test-mocks';

const actor: AuthenticatedUser = {
  id: 'owner-user',
  username: 'owner',
  displayName: 'Organization Owner',
  email: 'owner@example.test',
  mustChangePassword: false,
  sessionId: 'session-1',
  authorization: {
    roles: ['ORGANIZATION_OWNER'],
    permissions: ['security.users.manage', 'security.roles.manage'],
    scopeLevel: RoleScope.COMPANY_GROUP,
    isGlobal: false,
    activeCompanyGroupId: 'group-a',
    activeCompanyId: 'company-a',
    availableScopes: [],
  },
};

function serviceWith(prisma: Record<string, unknown>) {
  const passwords = {
    generateTemporaryPassword: jest
      .fn()
      .mockReturnValue('TemporaryPassword123!'),
    hashPassword: jest.fn().mockResolvedValue('password-hash'),
  };
  const sessions = createSessionServiceMock();
  const organizationScope = {
    assertCompanyGroup: jest.fn(),
    assertCompany: jest.fn().mockResolvedValue(undefined),
    assertBranch: jest.fn().mockResolvedValue(undefined),
  };
  const accountLifecycle = {
    prepareInvitation: jest.fn(),
    deliverInvitation: jest.fn(),
    requestPasswordReset: jest.fn(),
    resendInvitation: jest.fn(),
  };
  const audit = {
    log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  };

  return {
    service: new UserAdministrationService(
      prisma as never,
      passwords as never,
      sessions as never,
      organizationScope as never,
      accountLifecycle as never,
      audit as never,
    ),
    sessions,
    audit,
  };
}

describe('UserAdministrationService tenant isolation', () => {
  it('does not expose a tenant-visible user with assignments outside the active group', async () => {
    type AssignmentFilter = {
      isActive?: boolean;
      NOT?: AssignmentFilter;
    };
    type FindManyInput = {
      where: {
        AND: Array<{
          roleAssignments: {
            some?: AssignmentFilter;
            none?: AssignmentFilter;
          };
        }>;
      };
    };
    const findMany = jest.fn((input: FindManyInput) => {
      void input;
      return Promise.resolve([]);
    });
    const { service } = serviceWith({
      user: { findMany },
    });

    await service.findAll(actor);

    const query = findMany.mock.calls[0]?.[0];

    expect(query?.where.AND[0]?.roleAssignments.some?.isActive).toBe(true);
    expect(query?.where.AND[1]?.roleAssignments.none?.isActive).toBe(true);
    expect(query?.where.AND[1]?.roleAssignments.none?.NOT).toBeDefined();
  });

  it('prevents a tenant owner from granting any role containing platform access', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      role: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'custom-role',
            code: 'CUSTOM_ROLE',
            permissions: [
              {
                permission: { code: 'platform.admin' },
              },
            ],
          },
        ]),
      },
    };
    const { service } = serviceWith(prisma);

    await expect(
      service.create(
        actor,
        {
          username: 'new-user',
          displayName: 'New User',
          email: 'new-user@example.test',
          defaultCompanyId: 'company-a',
          roleAssignments: [
            {
              roleId: 'custom-role',
              scope: RoleScope.COMPANY,
              companyId: 'company-a',
            },
          ],
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('replaces only role assignments within the active Company Group', async () => {
    type DeleteManyInput = {
      where: {
        userId: string;
        isActive?: boolean;
        OR?: Array<{
          scope?: RoleScope;
          companyGroupId?: string;
        }>;
      };
    };
    const deleteMany = jest.fn((input: DeleteManyInput) => {
      void input;
      return Promise.resolve({ count: 1 });
    });
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'target-user' }]),
        findUnique: jest.fn().mockResolvedValue({
          defaultCompanyGroupId: 'group-a',
          defaultCompanyId: 'company-a',
          defaultBranchId: null,
        }),
        update: jest.fn().mockResolvedValue({ id: 'target-user' }),
      },
      role: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'owner-role',
            code: 'ORGANIZATION_OWNER',
            permissions: [],
          },
        ]),
      },
      userRoleAssignment: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany,
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      securityEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      async (operation: (transaction: typeof prisma) => Promise<unknown>) =>
        operation(prisma),
    );
    const { service, sessions } = serviceWith(prisma);

    await service.replaceAssignments(actor, 'target-user', [
      {
        roleId: 'owner-role',
        scope: RoleScope.COMPANY_GROUP,
        companyGroupId: 'group-a',
      },
    ]);

    const deleteWhere = deleteMany.mock.calls[0]?.[0].where;

    expect(deleteWhere?.userId).toBe('target-user');
    expect(deleteWhere?.isActive).toBeUndefined();
    expect(
      deleteWhere?.OR?.some(
        (condition) =>
          condition.scope === RoleScope.COMPANY_GROUP &&
          condition.companyGroupId === 'group-a',
      ),
    ).toBe(true);
    expect(sessions.revokeAllInTransaction).toHaveBeenCalledWith(
      prisma,
      'target-user',
      'ROLE_ASSIGNMENTS_CHANGED',
    );
  });

  it('protects the final active Organization Owner from being disabled', async () => {
    const update = jest.fn();
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'target-user' }]),
        count: jest.fn().mockResolvedValue(1),
        update,
      },
      userRoleAssignment: {
        findMany: jest.fn().mockResolvedValue([
          {
            companyGroupId: 'group-a',
            roleId: 'owner-role',
          },
        ]),
      },
      $executeRaw: jest.fn().mockResolvedValue(0),
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      async (operation: (transaction: typeof prisma) => Promise<unknown>) =>
        operation(prisma),
    );
    const { service } = serviceWith(prisma);

    await expect(
      service.updateStatus(actor, 'target-user', UserStatus.DISABLED),
    ).rejects.toMatchObject({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      response: expect.objectContaining({
        code: 'LAST_ORGANIZATION_OWNER',
      }),
    });
    expect(update).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
