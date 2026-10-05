import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY, setRequestActor } from '../../common';
import {
  AccessTokenPayload,
  AuthenticatedRequest,
  AuthenticatedUser,
} from './auth.types';
import { SessionService } from './session.service';

const PASSWORD_CHANGE_ALLOWED_PATHS = new Set([
  '/auth/me',
  '/auth/change-password',
  '/auth/logout',
  '/auth/logout-all',
  '/auth/sessions',
  '/auth/context',
]);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.readBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Authentication is required.');
    }

    let payload: AccessTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException(
        'The access token is invalid or expired.',
      );
    }

    if (
      payload.type !== 'access' ||
      !payload.sub ||
      !payload.sid ||
      !Number.isInteger(payload.ver)
    ) {
      throw new UnauthorizedException('The access token is invalid.');
    }

    const session = await this.sessionService.getActive(payload.sid);

    if (
      session.userId !== payload.sub ||
      session.securityVersion !== payload.ver
    ) {
      throw new UnauthorizedException('The session is no longer valid.');
    }

    const user: AuthenticatedUser = {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      email: session.email,
      employeeId: session.employeeId,
      mustChangePassword: session.mustChangePassword,
      sessionId: session.id,
      authorization: session.authorization,
    };

    request.user = user;
    setRequestActor({
      userId: user.id,
      sessionId: user.sessionId,
      activeCompanyGroupId: user.authorization.activeCompanyGroupId,
      activeCompanyId: user.authorization.activeCompanyId,
      activeBranchId: user.authorization.activeBranchId,
      scopeLevel: user.authorization.scopeLevel,
      isGlobal: user.authorization.isGlobal,
    });

    if (
      user.mustChangePassword &&
      !PASSWORD_CHANGE_ALLOWED_PATHS.has(request.path)
    ) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Change the temporary password before continuing.',
      });
    }

    return true;
  }

  private readBearerToken(header?: string): string | undefined {
    if (!header) {
      return undefined;
    }

    const [scheme, token] = header.trim().split(/\s+/, 2);

    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
  }
}
