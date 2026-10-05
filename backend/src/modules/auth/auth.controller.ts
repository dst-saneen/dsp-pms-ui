import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { Public } from '../../common';
import { Environment } from '../../config';
import { AuthService } from './auth.service';
import { AccountLifecycleService } from './account-lifecycle.service';
import type {
  AuthenticatedRequest,
  RequestSecurityMetadata,
} from './auth.types';
import { ChangeContextDto } from './dto/change-context.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { InspectInvitationDto } from './dto/inspect-invitation.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { ResendRegistrationDto } from './dto/resend-registration.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { RegistrationService } from './registration.service';
import { SessionService } from './session.service';

type RequestWithCookies = Request;
const AUTH_REFRESH_COOKIE_PATH = '/api/auth';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly cookieName: string;
  private readonly secureCookies: boolean;
  private readonly cookieMaxAgeMs: number;

  constructor(
    private readonly authService: AuthService,
    private readonly accountLifecycle: AccountLifecycleService,
    private readonly registrationService: RegistrationService,
    private readonly sessionService: SessionService,
    configService: ConfigService<Environment, true>,
  ) {
    this.cookieName = configService.getOrThrow('AUTH_REFRESH_COOKIE_NAME', {
      infer: true,
    });
    this.secureCookies =
      configService.getOrThrow('NODE_ENV', { infer: true }) === 'production';
    this.cookieMaxAgeMs =
      configService.getOrThrow('AUTH_SESSION_ABSOLUTE_TTL_SECONDS', {
        infer: true,
      }) * 1_000;
  }

  @Public()
  @Post('invitations/inspect')
  @HttpCode(HttpStatus.OK)
  inspectInvitation(@Body() dto: InspectInvitationDto) {
    return this.accountLifecycle.inspectInvitation(dto.token);
  }

  @Public()
  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken, ...result } =
      await this.accountLifecycle.acceptInvitation(
        dto.token,
        dto.password,
        this.metadata(request),
        {
          companyGroupId: dto.companyGroupId,
          companyId: dto.companyId,
          branchId: dto.branchId,
        },
      );
    this.setRefreshCookie(response, refreshToken);
    return result;
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.accountLifecycle.requestPasswordReset(
      dto.email,
      this.metadata(request),
    );
  }

  @Public()
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  resetForgottenPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: Request,
  ) {
    return this.accountLifecycle.resetPassword(
      dto.token,
      dto.password,
      this.metadata(request),
    );
  }

  @Public()
  @Get('capabilities')
  capabilities() {
    return this.registrationService.capabilities();
  }

  @Public()
  @Post('register-organization')
  async registerOrganization(
    @Body() dto: RegisterOrganizationDto,
    @Req() request: Request,
  ) {
    return this.registrationService.startOrganization(
      dto,
      this.metadata(request),
    );
  }

  @Public()
  @Post('registration/verify')
  @HttpCode(HttpStatus.OK)
  async verifyRegistration(
    @Body() dto: VerifyRegistrationDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken, ...result } =
      await this.registrationService.verifyOrganization(
        dto.registrationId,
        dto.code,
        this.metadata(request),
      );
    this.setRefreshCookie(response, refreshToken);
    return result;
  }

  @Public()
  @Post('registration/resend')
  @HttpCode(HttpStatus.OK)
  resendRegistration(
    @Body() dto: ResendRegistrationDto,
    @Req() request: Request,
  ) {
    return this.registrationService.resend(
      dto.registrationId,
      this.metadata(request),
    );
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { refreshToken, ...result } = await this.authService.login(
      dto.identifier,
      dto.password,
      this.metadata(request),
      {
        companyGroupId: dto.companyGroupId,
        companyId: dto.companyId,
        branchId: dto.branchId,
      },
    );
    this.setRefreshCookie(response, refreshToken);
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = this.readRefreshCookie(request.cookies as unknown);

    if (!refreshToken) {
      throw new UnauthorizedException('A refresh session is required.');
    }

    const { refreshToken: nextRefreshToken, ...result } =
      await this.authService.refresh(refreshToken, this.metadata(request));
    this.setRefreshCookie(response, nextRefreshToken);
    return result;
  }

  @ApiBearerAuth()
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }

  @ApiBearerAuth()
  @Patch('context')
  async changeContext(
    @Body() dto: ChangeContextDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const session = await this.sessionService.getActive(request.user.sessionId);
    return this.authService.changeContext(
      session,
      dto.companyId,
      dto.branchId,
      dto.companyGroupId,
      this.metadata(request),
    );
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.sessionService.getActive(request.user.sessionId);
    const { refreshToken, ...result } = await this.authService.changePassword(
      session,
      dto.currentPassword,
      dto.newPassword,
      this.metadata(request),
    );
    this.setRefreshCookie(response, refreshToken);
    return result;
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(
      request.user.id,
      request.user.sessionId,
      this.metadata(request),
    );
    this.clearRefreshCookie(response);
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logoutAll(request.user.id, this.metadata(request));
    this.clearRefreshCookie(response);
  }

  @ApiBearerAuth()
  @Get('sessions')
  sessions(@Req() request: AuthenticatedRequest) {
    return this.sessionService.list(request.user.id);
  }

  @ApiBearerAuth()
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.revokeOwnSession(
      request.user.id,
      sessionId,
      this.metadata(request),
    );

    if (sessionId === request.user.sessionId) {
      this.clearRefreshCookie(response);
    }
  }

  private metadata(request: Request): RequestSecurityMetadata {
    return {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };
  }

  private readRefreshCookie(cookies: unknown): string | undefined {
    if (!cookies || typeof cookies !== 'object') {
      return undefined;
    }

    const value = (cookies as Record<string, unknown>)[this.cookieName];
    return typeof value === 'string' ? value : undefined;
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(this.cookieName, refreshToken, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'strict',
      path: AUTH_REFRESH_COOKIE_PATH,
      maxAge: this.cookieMaxAgeMs,
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(this.cookieName, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'strict',
      path: AUTH_REFRESH_COOKIE_PATH,
    });
  }
}
