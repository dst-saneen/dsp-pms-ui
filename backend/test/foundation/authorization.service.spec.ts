import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RoleScope } from '@prisma/client';

import { AuthorizationService } from '../../src/modules/auth/authorization.service';

const assignment = (
  scope: RoleScope,
  scopeKey: string,
  permission: string,
  companyId?: string,
  branchId?: string,
  companyGroupId?: string,
) => ({
  scope,
  scopeKey,
  companyGroupId: companyGroupId ?? null,
  companyId: companyId ?? null,
  branchId: branchId ?? null,
  role: {
    code: permission.toUpperCase().replaceAll('.', '_'),
    permissions: [{ permission: { code: permission } }],
  },
  company: companyId
    ? {
        id: companyId,
        companyName: `Company ${companyId}`,
        companyGroupId: companyGroupId ?? null,
      }
    : null,
  companyGroup: companyGroupId
    ? {
        id: companyGroupId,
        groupName: `Group ${companyGroupId}`,
        companies: companyId
          ? [{ id: companyId, companyName: `Company ${companyId}` }]
          : [],
      }
    : null,
  branch: branchId
    ? {
        id: branchId,
        branchName: `Branch ${branchId}`,
        companyId,
      }
    : null,
});

describe('AuthorizationService organization isolation', () => {
  it('requires explicit selection instead of choosing the first of multiple scopes', async () => {
    const assignments = [
      assignment(
        RoleScope.COMPANY,
        'company:company-b',
        'hr.employees.read',
        'company-b',
        undefined,
        'group-b',
      ),
      assignment(
        RoleScope.COMPANY,
        'company:company-a',
        'hr.employees.read',
        'company-a',
        undefined,
        'group-a',
      ),
    ];
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          defaultCompanyGroupId: null,
          defaultCompanyId: null,
          defaultBranchId: null,
        }),
      },
      userRoleAssignment: {
        findMany: jest.fn().mockResolvedValue(assignments),
      },
      branch: { findUnique: jest.fn() },
      company: { findUnique: jest.fn() },
    };
    const service = new AuthorizationService(prisma as never);

    let caught: unknown;
    try {
      await service.buildSnapshot('user-1');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConflictException);
    expect((caught as ConflictException).getResponse()).toMatchObject({
      code: 'ORGANIZATION_SCOPE_SELECTION_REQUIRED',
      availableScopes: [{ companyId: 'company-a' }, { companyId: 'company-b' }],
    });
    expect(prisma.company.findUnique).not.toHaveBeenCalled();
    expect(prisma.branch.findUnique).not.toHaveBeenCalled();
  });

  it('keeps backward compatibility when exactly one valid scope exists', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          defaultCompanyGroupId: null,
          defaultCompanyId: null,
          defaultBranchId: null,
        }),
      },
      userRoleAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            assignment(
              RoleScope.BRANCH,
              'branch:branch-a',
              'hr.employees.read',
              'company-a',
              'branch-a',
              'group-a',
            ),
          ]),
      },
      branch: { findUnique: jest.fn() },
      company: { findUnique: jest.fn() },
    };
    const service = new AuthorizationService(prisma as never);

    const snapshot = await service.buildSnapshot('user-1');

    expect(snapshot).toMatchObject({
      scopeLevel: RoleScope.BRANCH,
      activeCompanyGroupId: 'group-a',
      activeCompanyId: 'company-a',
      activeBranchId: 'branch-a',
    });
  });

  it('does not merge a requested company with a persisted branch default', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          defaultCompanyGroupId: 'group-a',
          defaultCompanyId: 'company-a',
          defaultBranchId: 'branch-a',
        }),
      },
      userRoleAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            assignment(
              RoleScope.COMPANY,
              'company:company-a',
              'hr.employees.read',
              'company-a',
              undefined,
              'group-a',
            ),
            assignment(
              RoleScope.COMPANY,
              'company:company-b',
              'hr.employees.manage',
              'company-b',
              undefined,
              'group-b',
            ),
          ]),
      },
      branch: { findUnique: jest.fn() },
      company: {
        findUnique: jest.fn().mockResolvedValue({ companyGroupId: 'group-b' }),
      },
    };
    const service = new AuthorizationService(prisma as never);

    const snapshot = await service.buildSnapshot('user-1', 'company-b');

    expect(snapshot.activeCompanyId).toBe('company-b');
    expect(snapshot.activeBranchId).toBeUndefined();
    expect(snapshot.permissions).toEqual(['hr.employees.manage']);
    expect(prisma.branch.findUnique).not.toHaveBeenCalled();
  });

  it('does not combine permissions from different company assignments', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          defaultCompanyGroupId: 'group-a',
          defaultCompanyId: 'company-a',
          defaultBranchId: null,
        }),
      },
      userRoleAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            assignment(
              RoleScope.COMPANY,
              'company:company-a',
              'hr.employees.read',
              'company-a',
              undefined,
              'group-a',
            ),
            assignment(
              RoleScope.COMPANY,
              'company:company-b',
              'hr.employees.manage',
              'company-b',
              undefined,
              'group-b',
            ),
          ]),
      },
      branch: {
        findUnique: jest.fn(),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ companyGroupId: 'group-a' }),
      },
    };
    const service = new AuthorizationService(prisma as never);

    const snapshot = await service.buildSnapshot('user-1');

    expect(snapshot.activeCompanyId).toBe('company-a');
    expect(snapshot.permissions).toEqual(['hr.employees.read']);
    expect(snapshot.permissions).not.toContain('hr.employees.manage');
  });

  it('rejects a branch that does not belong to the selected company', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          defaultCompanyGroupId: null,
          defaultCompanyId: null,
          defaultBranchId: null,
        }),
      },
      userRoleAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            assignment(
              RoleScope.BRANCH,
              'branch:branch-b',
              'hr.employees.read',
              'company-b',
              'branch-b',
            ),
          ]),
      },
      branch: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'branch-b',
          companyId: 'company-b',
          company: { companyGroupId: 'group-b' },
        }),
      },
      company: {
        findUnique: jest.fn(),
      },
    };
    const service = new AuthorizationService(prisma as never);

    await expect(
      service.buildSnapshot('user-1', 'company-a', 'branch-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies a Company Group role across companies in only that group', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          defaultCompanyGroupId: 'group-a',
          defaultCompanyId: 'company-a',
          defaultBranchId: null,
        }),
      },
      userRoleAssignment: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            assignment(
              RoleScope.COMPANY_GROUP,
              'COMPANY_GROUP:group-a',
              'organization.companies.manage',
              undefined,
              undefined,
              'group-a',
            ),
            assignment(
              RoleScope.COMPANY_GROUP,
              'COMPANY_GROUP:group-b',
              'platform.admin',
              undefined,
              undefined,
              'group-b',
            ),
          ]),
      },
      branch: {
        findUnique: jest.fn(),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ companyGroupId: 'group-a' }),
      },
    };
    const service = new AuthorizationService(prisma as never);

    const snapshot = await service.buildSnapshot('user-1');

    expect(snapshot.scopeLevel).toBe(RoleScope.COMPANY_GROUP);
    expect(snapshot.activeCompanyGroupId).toBe('group-a');
    expect(snapshot.permissions).toEqual(['organization.companies.manage']);
    expect(snapshot.permissions).not.toContain('platform.admin');
  });
});
