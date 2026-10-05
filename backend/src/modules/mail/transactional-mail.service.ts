import {
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyModuleCode, DeliveryProvider } from '@prisma/client';
import nodemailer, { type Transporter } from 'nodemailer';

import { Environment } from '../../config';
import { CompanyModuleEntitlementService } from '../module-capabilities/company-module-entitlement.service';

export type DeliveryEmailErrorClass = 'TRANSIENT' | 'PERMANENT' | 'AMBIGUOUS';

export interface DeliveryEmailSendInput {
  to: string;
  displayName?: string;
  subject: string;
  text: string;
  html: string;
  clientReference: string;
}

export interface DeliveryEmailSendResult {
  disposition: 'ACCEPTED' | 'BYPASSED';
  provider: DeliveryProvider;
  requestId: string | null;
  emailReference: string | null;
}

export interface DeliveryEmailSendFailure extends Error {
  errorClass: DeliveryEmailErrorClass;
  providerCode: string;
  providerStatusCode?: number;
}

@Injectable()
export class TransactionalMailService {
  private readonly logger = new Logger(TransactionalMailService.name);
  private readonly enabled: boolean;
  private readonly developmentBypass: boolean;
  private readonly fromAddress?: string;
  private readonly fromName: string;
  private readonly replyTo?: string;
  private readonly transporter?: Transporter;

  constructor(
    configService: ConfigService<Environment, true>,
    @Optional()
    private readonly entitlements?: CompanyModuleEntitlementService,
  ) {
    this.enabled = configService.getOrThrow('EMAIL_ENABLED', { infer: true });
    this.developmentBypass = configService.getOrThrow('EMAIL_DEV_BYPASS', {
      infer: true,
    });
    this.fromAddress = configService.get('SMTP_FROM_ADDRESS', { infer: true });
    this.fromName = configService.getOrThrow('SMTP_FROM_NAME', {
      infer: true,
    });
    this.replyTo = configService.get('SMTP_REPLY_TO', { infer: true });

    if (!this.enabled || this.developmentBypass) {
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: configService.getOrThrow('SMTP_HOST', { infer: true }),
      port: configService.getOrThrow('SMTP_PORT', { infer: true }),
      secure: false,
      requireTLS: true,
      auth: {
        user: configService.getOrThrow('SMTP_USERNAME', { infer: true }),
        pass: configService.getOrThrow('SMTP_PASSWORD', { infer: true }),
      },
      connectionTimeout: configService.getOrThrow(
        'EMAIL_CONNECTION_TIMEOUT_MS',
        { infer: true },
      ),
      socketTimeout: configService.getOrThrow('EMAIL_SEND_TIMEOUT_MS', {
        infer: true,
      }),
      tls: {
        minVersion: 'TLSv1.2',
      },
    });
  }

  isAvailable(): boolean {
    if (this.developmentBypass) return true;
    return this.getDeliveryProviderReadiness().externalProviderReady;
  }

  isDevelopmentBypass(): boolean {
    return this.developmentBypass;
  }

  /** The Delivery queue records the transport used for each message. */
  getDeliveryProvider(): Extract<DeliveryProvider, 'SMTP'> {
    return DeliveryProvider.SMTP;
  }

  getDeliveryProviderReadiness(): {
    provider: Extract<DeliveryProvider, 'SMTP'>;
    externalProviderReady: boolean;
    developmentBypass: boolean;
  } {
    const provider = this.getDeliveryProvider();
    const externalProviderReady =
      this.enabled && Boolean(this.transporter && this.fromAddress);

    return {
      provider,
      externalProviderReady,
      developmentBypass: this.developmentBypass,
    };
  }

  /**
   * Sends a sealed Delivery queue snapshot through the configured provider.
   * This deliberately returns provider evidence and preserves retry classes;
   * callers must not convert a development bypass into an accepted send.
   */
  async sendDeliveryMessage(
    input: DeliveryEmailSendInput,
  ): Promise<DeliveryEmailSendResult> {
    if (this.developmentBypass) {
      return {
        disposition: 'BYPASSED',
        provider: DeliveryProvider.NONE,
        requestId: null,
        emailReference: null,
      };
    }

    if (!this.enabled) {
      throw this.buildDeliveryFailure({
        providerCode: 'EMAIL_DELIVERY_DISABLED',
        message: 'Email delivery is disabled.',
        // Deployment configuration can be restored without changing the
        // message or recipient, so preserve it for a later retry.
        errorClass: 'TRANSIENT',
      });
    }

    if (!this.transporter || !this.fromAddress) {
      throw this.buildDeliveryFailure({
        providerCode: 'SMTP_NOT_CONFIGURED',
        message: 'SMTP is not configured.',
        errorClass: 'TRANSIENT',
      });
    }

    try {
      const result: unknown = await this.transporter.sendMail({
        from: {
          name: this.fromName,
          address: this.fromAddress,
        },
        to: input.to,
        ...(this.replyTo ? { replyTo: this.replyTo } : {}),
        subject: input.subject,
        text: input.text,
        html: input.html,
        headers: {
          'X-TM-CLIENT-REF': input.clientReference,
        },
      });
      const messageId = this.readNonEmptyString(result, 'messageId');

      return {
        disposition: 'ACCEPTED',
        provider: DeliveryProvider.SMTP,
        // SMTP does not expose a durable provider request identifier. Its
        // Message-ID is retained as the provider email reference instead.
        requestId: null,
        emailReference: messageId,
      };
    } catch (error) {
      throw this.classifySmtpFailure(error);
    }
  }

  async sendVerificationCode(input: {
    to: string;
    displayName: string;
    code: string;
    expiresInMinutes: number;
    clientReference: string;
  }): Promise<'SENT' | 'BYPASSED'> {
    const safeName = this.escapeHtml(input.displayName);
    return this.send({
      to: input.to,
      displayName: input.displayName,
      clientReference: input.clientReference,
      failureEvent: 'email.verification.delivery_failed',
      subject: 'Your Group ERP verification code',
      text: [
        `Hello ${input.displayName},`,
        '',
        `Your Group ERP verification code is ${input.code}.`,
        `It expires in ${input.expiresInMinutes} minutes.`,
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: [
        `<p>Hello ${safeName},</p>`,
        '<p>Your Group ERP verification code is:</p>',
        `<p style="font-size:28px;font-weight:700;letter-spacing:6px">${input.code}</p>`,
        `<p>This code expires in ${input.expiresInMinutes} minutes.</p>`,
        '<p>If you did not request this, you can ignore this email.</p>',
      ].join(''),
    });
  }

  async sendInvitationLink(input: {
    to: string;
    displayName: string;
    invitationUrl: string;
    expiresInHours: number;
    clientReference: string;
  }): Promise<'SENT' | 'BYPASSED'> {
    const safeName = this.escapeHtml(input.displayName);
    const safeUrl = this.escapeHtml(input.invitationUrl);

    return this.send({
      to: input.to,
      clientReference: input.clientReference,
      failureEvent: 'email.invitation.delivery_failed',
      subject: 'You are invited to Group ERP',
      text: [
        `Hello ${input.displayName},`,
        '',
        'An administrator invited you to Group ERP.',
        `Set your password and activate your account: ${input.invitationUrl}`,
        `This link expires in ${input.expiresInHours} hours.`,
        '',
        'If you were not expecting this invitation, you can ignore this email.',
      ].join('\n'),
      html: [
        `<p>Hello ${safeName},</p>`,
        '<p>An administrator invited you to Group ERP.</p>',
        `<p><a href="${safeUrl}">Set your password and activate your account</a></p>`,
        `<p>This link expires in ${input.expiresInHours} hours.</p>`,
        '<p>If you were not expecting this invitation, you can ignore this email.</p>',
      ].join(''),
    });
  }

  async sendPasswordResetLink(input: {
    to: string;
    displayName: string;
    resetUrl: string;
    expiresInMinutes: number;
    clientReference: string;
  }): Promise<'SENT' | 'BYPASSED'> {
    const safeName = this.escapeHtml(input.displayName);
    const safeUrl = this.escapeHtml(input.resetUrl);

    return this.send({
      to: input.to,
      clientReference: input.clientReference,
      failureEvent: 'email.password_reset.delivery_failed',
      subject: 'Reset your Group ERP password',
      text: [
        `Hello ${input.displayName},`,
        '',
        'A password reset was requested for your Group ERP account.',
        `Choose a new password: ${input.resetUrl}`,
        `This link expires in ${input.expiresInMinutes} minutes.`,
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: [
        `<p>Hello ${safeName},</p>`,
        '<p>A password reset was requested for your Group ERP account.</p>',
        `<p><a href="${safeUrl}">Choose a new password</a></p>`,
        `<p>This link expires in ${input.expiresInMinutes} minutes.</p>`,
        '<p>If you did not request this, you can ignore this email.</p>',
      ].join(''),
    });
  }

  /**
   * Generic workforce / onboarding notification email (SMTP when V2 is off).
   * Used by the legacy outbox path so in-app events can also reach the inbox.
   */
  async sendNotificationAlert(input: {
    to: string;
    displayName: string;
    subject: string;
    message: string;
    actionUrl?: string | null;
    clientReference: string;
  }): Promise<'SENT' | 'BYPASSED'> {
    const safeName = this.escapeHtml(input.displayName);
    const safeMessage = this.escapeHtml(input.message);
    const actionUrl = input.actionUrl?.trim() || null;
    const safeUrl = actionUrl ? this.escapeHtml(actionUrl) : null;

    return this.send({
      to: input.to,
      displayName: input.displayName,
      clientReference: input.clientReference,
      failureEvent: 'email.notification.delivery_failed',
      subject: input.subject,
      text: [
        `Hello ${input.displayName},`,
        '',
        input.message,
        ...(actionUrl ? ['', `Open in Group ERP: ${actionUrl}`] : []),
        '',
        'If you were not expecting this message, you can ignore this email.',
      ].join('\n'),
      html: [
        `<p>Hello ${safeName},</p>`,
        `<p>${safeMessage}</p>`,
        ...(safeUrl
          ? [`<p><a href="${safeUrl}">Open in Group ERP</a></p>`]
          : []),
        '<p>If you were not expecting this message, you can ignore this email.</p>',
      ].join(''),
    });
  }

  async sendRecruitmentMessage(input: {
    to: string;
    displayName: string;
    subject: string;
    text: string;
    html: string;
    clientReference: string;
    failureEvent: string;
    companyId?: string | null;
    branchId?: string | null;
  }): Promise<'SENT' | 'BYPASSED'> {
    if (await this.isRecruitmentDeliveryOwned(input.companyId)) {
      this.logger.debug({
        event: 'recruitment.mail.owned_by_delivery',
        clientReference: input.clientReference,
      });
      return 'BYPASSED';
    }

    return this.send({
      to: input.to,
      displayName: input.displayName,
      clientReference: input.clientReference,
      failureEvent: input.failureEvent,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }

  private async isRecruitmentDeliveryOwned(
    companyId?: string | null,
  ): Promise<boolean> {
    if (!companyId || !this.entitlements) {
      return false;
    }
    return this.entitlements.isEnabled(companyId, CompanyModuleCode.DELIVERY);
  }

  private async send(input: {
    to: string;
    displayName?: string;
    clientReference: string;
    failureEvent: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<'SENT' | 'BYPASSED'> {
    try {
      const result = await this.sendDeliveryMessage(input);
      return result.disposition === 'BYPASSED' ? 'BYPASSED' : 'SENT';
    } catch (error) {
      this.logger.warn({
        event: input.failureEvent,
        errorName: error instanceof Error ? error.name : 'UnknownEmailError',
      });
      throw new ServiceUnavailableException({
        code: 'EMAIL_DELIVERY_UNAVAILABLE',
        message: 'Email delivery is temporarily unavailable.',
      });
    }
  }

  private classifySmtpFailure(error: unknown): DeliveryEmailSendFailure {
    const maybe = error as {
      code?: unknown;
      command?: unknown;
      responseCode?: unknown;
      message?: unknown;
    };
    const responseCode =
      typeof maybe?.responseCode === 'number' &&
      Number.isFinite(maybe.responseCode)
        ? maybe.responseCode
        : undefined;
    const code = typeof maybe?.code === 'string' ? maybe.code : undefined;
    const command =
      typeof maybe?.command === 'string' ? maybe.command.toUpperCase() : '';

    let errorClass: DeliveryEmailErrorClass = 'TRANSIENT';
    if (responseCode !== undefined) {
      errorClass = responseCode >= 500 ? 'PERMANENT' : 'TRANSIENT';
    } else if (['EAUTH', 'EENVELOPE', 'EMESSAGE'].includes(code ?? '')) {
      errorClass = 'PERMANENT';
    } else if (
      command === 'DATA' &&
      ['ETIMEDOUT', 'ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ESOCKET'].includes(
        code ?? '',
      )
    ) {
      // SMTP may have accepted the DATA payload before this connection error.
      errorClass = 'AMBIGUOUS';
    }

    return this.buildDeliveryFailure({
      providerCode:
        responseCode !== undefined
          ? `SMTP_${responseCode}`
          : code
            ? `SMTP_${code}`
            : 'SMTP_SEND_ERROR',
      message:
        typeof maybe?.message === 'string'
          ? maybe.message
          : 'SMTP delivery failed.',
      errorClass,
      providerStatusCode: responseCode,
    });
  }

  private buildDeliveryFailure(input: {
    providerCode: string;
    message: string;
    errorClass: DeliveryEmailErrorClass;
    providerStatusCode?: number;
  }): DeliveryEmailSendFailure {
    return Object.assign(new Error(input.message), {
      name: 'DeliveryEmailSendFailure',
      errorClass: input.errorClass,
      providerCode: input.providerCode,
      providerStatusCode: input.providerStatusCode,
    });
  }

  private readNonEmptyString(value: unknown, key: string): string | null {
    if (!value || typeof value !== 'object') return null;
    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === 'string' && candidate.length > 0
      ? candidate
      : null;
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        })[character] ?? character,
    );
  }
}
