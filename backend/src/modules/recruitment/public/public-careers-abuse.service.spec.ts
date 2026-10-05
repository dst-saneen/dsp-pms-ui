import { PublicCareersAbuseService } from './public-careers-abuse.service';

describe('PublicCareersAbuseService', () => {
  const redisService = {
    incrementWithExpiry: jest.fn(),
  };
  const passwordService = {
    hashMetadata: jest.fn().mockReturnValue('hashed-ip'),
  };
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'NODE_ENV') return 'test';
      if (key === 'PUBLIC_CAREERS_RATE_LIMIT_PER_HOUR') return 10;
      return undefined;
    }),
    get: jest.fn(),
  };

  const service = new PublicCareersAbuseService(
    configService as never,
    redisService as never,
    passwordService as never,
  );

  it('treats a filled honeypot as a bot submission', () => {
    expect(service.isHoneypotTriggered('http://spam.test')).toBe(true);
    expect(service.isHoneypotTriggered('')).toBe(false);
    expect(service.parseHoneypot({ honeypot: 'x' })).toBe('x');
  });

  it('returns a non-enumerating honeypot receipt', () => {
    const receipt = service.honeypotResponse(new Date('2026-08-17T00:00:00Z'));
    expect(receipt.status).toBe('RECEIVED');
    expect(receipt.applicationCode).toBe('RECEIVED');
  });

  it('skips Turnstile in test when no secret is configured', async () => {
    await expect(service.verifyTurnstile(undefined)).resolves.toBeUndefined();
  });

  it('rate-limits repeated public submissions', async () => {
    redisService.incrementWithExpiry.mockResolvedValue(11);

    await expect(
      service.enforceRateLimit({
        ip: '1.1.1.1',
        email: 'a@example.com',
        openingId: 'open-1',
      }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('rate-limits public upload-session creation before object storage is issued', async () => {
    redisService.incrementWithExpiry.mockResolvedValue(11);

    await expect(
      service.enforceUploadSessionRateLimit({
        ip: '1.1.1.1',
        openingId: 'open-1',
      }),
    ).rejects.toMatchObject({ status: 429 });

    expect(redisService.incrementWithExpiry).toHaveBeenCalledWith(
      'recruitment:careers:upload-session:open-1:hashed-ip',
      3_600,
    );
  });
});
