import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PermissionGuard } from '../../src/modules/auth/permission.guard';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../../src/modules/auth/auth.types';

function testUser(permissions: string[]): AuthenticatedUser {
  return {
    id: 'user-1',
    username: 'user-1',
    sessionId: 'session-1',
    mustChangePassword: false,
    authorization: {
      isGlobal: false,
      roles: ['EMPLOYEE'],
      permissions,
      scopeLevel: 'COMPANY',
      activeCompanyId: 'company-1',
      availableScopes: [],
    },
  };
}

describe('PermissionGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new PermissionGuard(reflector);

  function contextFor(request: Partial<AuthenticatedRequest>) {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as never;
  }

  beforeEach(() => {
    (reflector.getAllAndOverride as jest.Mock).mockReset();
  });

  it('allows authenticated self-service auth routes with no domain permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === 'isPublic') {
        return false;
      }

      return undefined;
    });

    const allowed = guard.canActivate(
      contextFor({
        method: 'POST',
        path: '/auth/logout-all',
        user: testUser(['dashboard.read']),
      }),
    );

    expect(allowed).toBe(true);
  });

  it('still forbids unclassified routes for non-platform users', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === 'isPublic') {
        return false;
      }

      return undefined;
    });

    expect(() =>
      guard.canActivate(
        contextFor({
          method: 'GET',
          path: '/project-tasks',
          user: testUser(['dashboard.read']),
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows when the caller holds any listed permission', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === 'isPublic') {
        return false;
      }
      if (key === 'requiredAnyPermissions') {
        return ['hr.leave.manage', 'hr.team.approve'];
      }
      return undefined;
    });

    const allowed = guard.canActivate(
      contextFor({
        method: 'POST',
        path: '/leave-requests/lr-1/approve',
        user: testUser(['hr.team.approve']),
      }),
    );

    expect(allowed).toBe(true);
  });

  it('forbids when the caller holds none of the any-permissions', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === 'isPublic') {
        return false;
      }
      if (key === 'requiredAnyPermissions') {
        return ['hr.leave.manage', 'hr.team.approve'];
      }
      return undefined;
    });

    expect(() =>
      guard.canActivate(
        contextFor({
          method: 'POST',
          path: '/leave-requests/lr-1/approve',
          user: testUser(['hr.leave.read']),
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('still requires every listed permission for RequirePermissions', () => {
    (reflector.getAllAndOverride as jest.Mock).mockImplementation((key) => {
      if (key === 'isPublic') {
        return false;
      }
      if (key === 'requiredAnyPermissions') {
        return undefined;
      }
      if (key === 'requiredPermissions') {
        return ['hr.leave.manage', 'security.roles.manage'];
      }
      return undefined;
    });

    expect(() =>
      guard.canActivate(
        contextFor({
          method: 'POST',
          path: '/leave-requests/lr-1/approve',
          user: testUser(['hr.leave.manage']),
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
