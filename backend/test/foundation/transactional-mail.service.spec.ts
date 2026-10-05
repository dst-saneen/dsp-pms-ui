import nodemailer from 'nodemailer';
import { CompanyModuleCode, DeliveryProvider } from '@prisma/client';

import { TransactionalMailService } from '../../src/modules/mail/transactional-mail.service';

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(),
  },
}));

const createTransport = jest.mocked(nodemailer.createTransport);
const sendMail = jest.fn().mockResolvedValue({ messageId: 'message-1' });

function configuration(
  overrides: Record<string, string | number | boolean | undefined> = {},
) {
  const values: Record<string, string | number | boolean | undefined> = {
    EMAIL_ENABLED: true,
    EMAIL_DEV_BYPASS: false,
    SMTP_FROM_ADDRESS: 'noreply@example.test',
    SMTP_FROM_NAME: 'Group ERP',
    SMTP_REPLY_TO: undefined,
    SMTP_HOST: 'smtp.zeptomail.in',
    SMTP_PORT: 587,
    SMTP_USERNAME: 'emailapikey',
    SMTP_PASSWORD: 'send-mail-token',
    EMAIL_CONNECTION_TIMEOUT_MS: 10_000,
    EMAIL_SEND_TIMEOUT_MS: 30_000,
    ...overrides,
  };

  return {
    get: jest.fn((key: string) => values[key]),
    getOrThrow: jest.fn((key: string) => values[key]),
  };
}

describe('TransactionalMailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendMail.mockReset().mockResolvedValue({ messageId: 'message-1' });
    createTransport.mockReturnValue({ sendMail } as never);
  });

  it('uses STARTTLS on port 587 with TLS 1.2 and the configured safeguards', () => {
    new TransactionalMailService(configuration() as never);

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.zeptomail.in',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: 'emailapikey',
        pass: 'send-mail-token',
      },
      connectionTimeout: 10_000,
      socketTimeout: 30_000,
      tls: {
        minVersion: 'TLSv1.2',
      },
    });
  });

  it('does not create an SMTP connection in development bypass mode', async () => {
    const service = new TransactionalMailService(
      configuration({
        EMAIL_DEV_BYPASS: true,
        SMTP_FROM_ADDRESS: undefined,
      }) as never,
    );

    const result = await service.sendVerificationCode({
      to: 'owner@example.test',
      displayName: 'Avery Owner',
      code: '123456',
      expiresInMinutes: 10,
      clientReference: 'registration-1',
    });
    const invitationResult = await service.sendInvitationLink({
      to: 'user@example.test',
      displayName: 'Invited User',
      invitationUrl: 'http://localhost:3200/accept-invitation?token=secret',
      expiresInHours: 24,
      clientReference: 'invitation-1',
    });
    const resetResult = await service.sendPasswordResetLink({
      to: 'user@example.test',
      displayName: 'Invited User',
      resetUrl: 'http://localhost:3200/reset-password?token=secret',
      expiresInMinutes: 30,
      clientReference: 'reset-1',
    });

    expect(result).toBe('BYPASSED');
    expect(invitationResult).toBe('BYPASSED');
    expect(resetResult).toBe('BYPASSED');
    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('returns SMTP evidence for Delivery instead of assuming ZeptoMail', async () => {
    const service = new TransactionalMailService(configuration() as never);

    const result = await service.sendDeliveryMessage({
      to: 'employee@example.test',
      displayName: 'Employee',
      subject: 'Workflow update',
      text: 'Your task is ready.',
      html: '<p>Your task is ready.</p>',
      clientReference: 'delivery-message-1',
    });

    expect(result).toEqual({
      disposition: 'ACCEPTED',
      provider: DeliveryProvider.SMTP,
      requestId: null,
      emailReference: 'message-1',
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-TM-CLIENT-REF': 'delivery-message-1' },
      }),
    );
  });

  it('classifies an SMTP DATA timeout as ambiguous to prevent blind resend', async () => {
    sendMail.mockRejectedValue(
      Object.assign(new Error('Socket timed out'), {
        code: 'ETIMEDOUT',
        command: 'DATA',
      }),
    );
    const service = new TransactionalMailService(configuration() as never);

    await expect(
      service.sendDeliveryMessage({
        to: 'employee@example.test',
        subject: 'Workflow update',
        text: 'Your task is ready.',
        html: '<p>Your task is ready.</p>',
        clientReference: 'delivery-message-2',
      }),
    ).rejects.toMatchObject({
      errorClass: 'AMBIGUOUS',
      providerCode: 'SMTP_ETIMEDOUT',
    });
  });

  it('records development bypass as a non-provider result', async () => {
    const service = new TransactionalMailService(
      configuration({
        EMAIL_DEV_BYPASS: true,
        SMTP_FROM_ADDRESS: undefined,
      }) as never,
    );

    await expect(
      service.sendDeliveryMessage({
        to: 'employee@example.test',
        subject: 'Workflow update',
        text: 'Your task is ready.',
        html: '<p>Your task is ready.</p>',
        clientReference: 'delivery-message-3',
      }),
    ).resolves.toEqual({
      disposition: 'BYPASSED',
      provider: DeliveryProvider.NONE,
      requestId: null,
      emailReference: null,
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('keeps queued mail retryable when delivery is temporarily disabled', async () => {
    const service = new TransactionalMailService(
      configuration({ EMAIL_ENABLED: false }) as never,
    );

    await expect(
      service.sendDeliveryMessage({
        to: 'employee@example.test',
        subject: 'Workflow update',
        text: 'Your task is ready.',
        html: '<p>Your task is ready.</p>',
        clientReference: 'delivery-message-4',
      }),
    ).rejects.toMatchObject({
      errorClass: 'TRANSIENT',
      providerCode: 'EMAIL_DELIVERY_DISABLED',
    });
  });

  it('bypasses direct recruitment mail when Delivery is enabled for the company', async () => {
    const entitlements = {
      isEnabled: jest.fn().mockResolvedValue(true),
    };
    const service = new TransactionalMailService(
      configuration() as never,
      entitlements as never,
    );

    const result = await service.sendRecruitmentMessage({
      to: 'candidate@example.test',
      displayName: 'Candidate',
      subject: 'Interview update',
      text: 'Your interview is scheduled.',
      html: '<p>Your interview is scheduled.</p>',
      clientReference: 'recruitment-message-1',
      failureEvent: 'recruitment.mail.delivery_failed',
      companyId: 'company-1',
    });

    expect(result).toBe('BYPASSED');
    expect(entitlements.isEnabled).toHaveBeenCalledWith(
      'company-1',
      CompanyModuleCode.DELIVERY,
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends direct recruitment mail when Delivery is disabled for the company', async () => {
    const entitlements = {
      isEnabled: jest.fn().mockResolvedValue(false),
    };
    const service = new TransactionalMailService(
      configuration() as never,
      entitlements as never,
    );

    const result = await service.sendRecruitmentMessage({
      to: 'candidate@example.test',
      displayName: 'Candidate',
      subject: 'Interview update',
      text: 'Your interview is scheduled.',
      html: '<p>Your interview is scheduled.</p>',
      clientReference: 'recruitment-message-2',
      failureEvent: 'recruitment.mail.delivery_failed',
      companyId: 'company-1',
    });

    expect(result).toBe('SENT');
    expect(entitlements.isEnabled).toHaveBeenCalledWith(
      'company-1',
      CompanyModuleCode.DELIVERY,
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'candidate@example.test',
        headers: { 'X-TM-CLIENT-REF': 'recruitment-message-2' },
      }),
    );
  });
});
