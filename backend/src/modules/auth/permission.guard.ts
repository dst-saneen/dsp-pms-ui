import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  IS_PUBLIC_KEY,
  REQUIRED_ANY_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from '../../common';
import { AuthenticatedRequest } from './auth.types';
import { resolveRoutePermissions } from './route-policy';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return false;
    }

    if (
      user.authorization.roles.includes('SUPER_ADMINISTRATOR') ||
      user.authorization.permissions.includes('platform.admin')
    ) {
      return true;
    }

    const anyPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (anyPermissions && anyPermissions.length > 0) {
      if (
        anyPermissions.some((permission) =>
          user.authorization.permissions.includes(permission),
        )
      ) {
        return true;
      }
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }

    const explicitPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredPermissions =
      explicitPermissions ?? this.inferPermissions(request);

    // Empty list = authenticated self-service (e.g. /auth/logout). Any signed-in
    // user may proceed; deny-by-default still applies to unclassified routes via
    // platform.admin from resolveRoutePermissions.
    if (requiredPermissions.length === 0) {
      return true;
    }

    if (
      requiredPermissions.every((permission) =>
        user.authorization.permissions.includes(permission),
      )
    ) {
      return true;
    }

    throw new ForbiddenException(
      'You do not have permission to perform this action.',
    );
  }

  private inferPermissions(request: AuthenticatedRequest): string[] {
    return resolveRoutePermissions(request.path, request.method);
  }
}
