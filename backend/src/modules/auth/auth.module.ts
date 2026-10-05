import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { existsSync, readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { resolve } from 'node:path';

import { Environment } from '../../config';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AccountLifecycleService } from './account-lifecycle.service';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { AuthorizationService } from './authorization.service';
import { OrganizationScopeGuard } from './organization-scope.guard';
import { EmployeeDomainScopeService } from './employee-domain-scope.service';
import { OrganizationScopeService } from './organization-scope.service';
import { PasswordService } from './password.service';
import { PermissionGuard } from './permission.guard';
import { RedisService } from './redis.service';
import { RegistrationService } from './registration.service';
import { RoleAdministrationService } from './role-administration.service';
import { SessionService } from './session.service';
import { UserAdministrationController } from './user-administration.controller';
import { UserAdministrationService } from './user-administration.service';

let testKeys:
  | {
      privateKey: string;
      publicKey: string;
    }
  | undefined;

function readJwtKeys(configService: ConfigService<Environment, true>) {
  const privateKeyPath = resolve(
    process.cwd(),
    configService.getOrThrow('AUTH_JWT_PRIVATE_KEY_PATH', { infer: true }),
  );
  const publicKeyPath = resolve(
    process.cwd(),
    configService.getOrThrow('AUTH_JWT_PUBLIC_KEY_PATH', { infer: true }),
  );

  if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
    return {
      privateKey: readFileSync(privateKeyPath, 'utf8'),
      publicKey: readFileSync(publicKeyPath, 'utf8'),
    };
  }

  if (configService.getOrThrow('NODE_ENV', { infer: true }) !== 'test') {
    throw new Error('JWT signing key files are unavailable.');
  }

  testKeys ??= generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return testKeys;
}

@Global()
@Module({
  imports: [
    ConfigModule,
    AuditModule,
    MailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Environment, true>) => ({
        ...readJwtKeys(configService),
        signOptions: {
          algorithm: 'RS256' as const,
          issuer: configService.getOrThrow('AUTH_ISSUER', { infer: true }),
          audience: configService.getOrThrow('AUTH_AUDIENCE', { infer: true }),
        },
        verifyOptions: {
          algorithms: ['RS256' as const],
          issuer: configService.getOrThrow('AUTH_ISSUER', { infer: true }),
          audience: configService.getOrThrow('AUTH_AUDIENCE', { infer: true }),
        },
      }),
    }),
  ],
  controllers: [AuthController, UserAdministrationController],
  providers: [
    AccountLifecycleService,
    AuthService,
    AuthorizationService,
    EmployeeDomainScopeService,
    OrganizationScopeService,
    PasswordService,
    RedisService,
    RegistrationService,
    RoleAdministrationService,
    SessionService,
    UserAdministrationService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OrganizationScopeGuard,
    },
  ],
  exports: [
    AccountLifecycleService,
    AuthorizationService,
    EmployeeDomainScopeService,
    OrganizationScopeService,
    PasswordService,
    RedisService,
    SessionService,
  ],
})
export class AuthModule {}
