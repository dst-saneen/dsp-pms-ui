import {
  FileUploadPurpose,
  FileUploadSessionStatus,
  JobOpeningStatus,
} from '@prisma/client';
import type { Request } from 'express';

import { FileStorageController } from '../../src/modules/file-storage/file-storage.controller';
import { hashPublicSessionToken } from '../../src/modules/file-storage/file-storage.crypto';
import { FileUploadSessionService } from '../../src/modules/file-storage/services/file-upload-session.service';
import { PublicCareerOpeningService } from '../../src/modules/recruitment/public/public-career-opening.service';

const opening = {
  id: 'opening-a',
  companyGroupId: 'group-a',
  companyId: 'company-a',
  branchId: 'branch-a',
  openingCode: 'QA-OPENING-A',
  title: 'QA Engineer',
  description: null,
  employmentType: 'FULL_TIME',
  location: 'Kochi',
  applicationDeadline: null,
  publishedAt: new Date('2026-09-18T00:00:00.000Z'),
  department: { departmentName: 'Engineering' },
  designation: { designationName: 'Software Engineer' },
};

const openingRecord = {
  ...opening,
  company: { companyGroupId: opening.companyGroupId },
};

const storageFeatures = {
  assertStorageAvailable: jest.fn().mockResolvedValue(undefined),
};

interface PublicOpeningQuery {
  where: Record<string, unknown>;
}

interface PublicSessionQuery {
  where: Record<string, unknown>;
}

describe('public careers upload entitlement boundary', () => {
  const findCompany = jest.fn<Promise<unknown>, [unknown]>();
  const findJobOpening = jest.fn<Promise<unknown>, [PublicOpeningQuery]>();
  const findJobOpenings = jest.fn<Promise<unknown>, [unknown]>();
  const prisma = {
    company: { findFirst: findCompany },
    jobOpening: { findFirst: findJobOpening, findMany: findJobOpenings },
  };
  const config = { get: jest.fn() };
  const recruitmentFeature = { assertEnabledForCompany: jest.fn() };
  const entitlements = { isEnabled: jest.fn() };
  const openingResolver = new PublicCareerOpeningService(
    prisma as never,
    config as never,
    recruitmentFeature as never,
    entitlements as never,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue(true);
    prisma.jobOpening.findFirst.mockResolvedValue(openingRecord);
    recruitmentFeature.assertEnabledForCompany.mockResolvedValue(undefined);
    entitlements.isEnabled.mockResolvedValue(true);
  });

  it('fails closed when public careers is disabled globally', async () => {
    config.get.mockReturnValue(false);

    await expect(
      openingResolver.resolveOpeningById(opening.id, {
        requireFileStorage: true,
      }),
    ).rejects.toMatchObject({ response: { code: 'PUBLIC_CAREERS_DISABLED' } });

    expect(prisma.jobOpening.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an active opening when Recruitment is disabled for its Company', async () => {
    recruitmentFeature.assertEnabledForCompany.mockRejectedValue({
      response: {
        code: 'RECRUITMENT_MODULE_NOT_ENABLED',
      },
    });

    await expect(
      openingResolver.resolveOpeningById(opening.id, {
        requireFileStorage: true,
      }),
    ).rejects.toMatchObject({
      response: { code: 'RECRUITMENT_MODULE_NOT_ENABLED' },
    });

    expect(entitlements.isEnabled).not.toHaveBeenCalled();
  });

  it('rejects an active opening when File Storage is disabled for its Company', async () => {
    entitlements.isEnabled.mockResolvedValue(false);

    await expect(
      openingResolver.resolveOpeningById(opening.id, {
        requireFileStorage: true,
      }),
    ).rejects.toMatchObject({
      response: { code: 'FILE_STORAGE_MODULE_NOT_ENABLED' },
    });
  });

  it.each(['draft', 'closed', 'expired'])(
    'does not resolve a %s opening for public upload',
    async () => {
      prisma.jobOpening.findFirst.mockResolvedValue(null);

      await expect(
        openingResolver.resolveOpeningById(opening.id, {
          requireFileStorage: true,
        }),
      ).rejects.toMatchObject({ response: { code: 'OPENING_NOT_FOUND' } });

      const query = findJobOpening.mock.calls[0][0];
      expect(query.where).toEqual(
        expect.objectContaining({
          status: JobOpeningStatus.OPEN,
          publishedAt: { not: null },
          company: { isActive: true },
        }),
      );
      const deadlineClauses = query.where.OR as Array<{
        applicationDeadline: null | { gt?: unknown };
      }>;
      expect(deadlineClauses[0]).toEqual({ applicationDeadline: null });
      expect(deadlineClauses[1]?.applicationDeadline?.gt).toBeInstanceOf(Date);
    },
  );

  it('resolves a valid published opening only after both Company entitlements pass', async () => {
    await expect(
      openingResolver.resolveOpeningById(opening.id),
    ).resolves.toEqual(opening);

    expect(recruitmentFeature.assertEnabledForCompany).toHaveBeenCalledWith(
      opening.companyId,
    );
    expect(entitlements.isEnabled).toHaveBeenCalledWith(
      opening.companyId,
      'FILE_STORAGE',
    );
  });

  it('sends a valid public session create through the resolver and abuse boundary', async () => {
    const sessionService = {
      createSession: jest.fn().mockResolvedValue({ id: 'session-a' }),
    };
    const resolver = {
      resolveOpeningById: jest.fn().mockResolvedValue(opening),
    };
    const abuse = {
      verifyTurnstile: jest.fn().mockResolvedValue(undefined),
      enforceUploadSessionRateLimit: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new FileStorageController(
      sessionService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      resolver as never,
      abuse as never,
    );
    const body = {
      applicationOperationId: 'operation-a',
      purpose: 'CV' as const,
      fileName: 'cv.pdf',
      declaredMimeType: 'application/pdf',
      sizeBytes: 42,
      checksumSha256: 'a'.repeat(64),
      antiAbuseToken: 'turnstile-token',
    };

    await expect(
      controller.createPublicUploadSession(opening.id, body, {
        ip: '203.0.113.7',
      } as Request),
    ).resolves.toEqual({ id: 'session-a' });

    expect(resolver.resolveOpeningById).toHaveBeenCalledWith(opening.id, {
      requireFileStorage: true,
    });
    expect(abuse.verifyTurnstile).toHaveBeenCalledWith(
      'turnstile-token',
      '203.0.113.7',
    );
    expect(abuse.enforceUploadSessionRateLimit).toHaveBeenCalledWith({
      ip: '203.0.113.7',
      openingId: opening.id,
    });
    expect(sessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: opening.companyId,
        branchId: opening.branchId,
        jobOpeningId: opening.id,
        issuePublicSessionToken: true,
      }),
    );
  });

  it('resolves the opening again and carries its ID into public session reads and finalization', async () => {
    const sessionService = {
      finalizePublicOpeningSession: jest
        .fn()
        .mockResolvedValue({ id: 'session-a', status: 'UPLOADED' }),
      getPublicOpeningSession: jest
        .fn()
        .mockResolvedValue({ id: 'session-a', status: 'ISSUED' }),
    };
    const resolver = {
      resolveOpeningById: jest.fn().mockResolvedValue(opening),
    };
    const controller = new FileStorageController(
      sessionService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      resolver as never,
      {} as never,
    );

    await controller.finalizePublicOpeningSession(
      opening.id,
      'session-a',
      'session-token-a',
    );
    await controller.getPublicOpeningSession(
      opening.id,
      'session-a',
      'session-token-a',
    );

    expect(resolver.resolveOpeningById).toHaveBeenCalledTimes(2);
    expect(resolver.resolveOpeningById).toHaveBeenCalledWith(opening.id, {
      requireFileStorage: true,
    });
    expect(sessionService.finalizePublicOpeningSession).toHaveBeenCalledWith({
      sessionId: 'session-a',
      companyId: opening.companyId,
      jobOpeningId: opening.id,
      publicSessionToken: 'session-token-a',
    });
    expect(sessionService.getPublicOpeningSession).toHaveBeenCalledWith({
      sessionId: 'session-a',
      companyId: opening.companyId,
      jobOpeningId: opening.id,
      publicSessionToken: 'session-token-a',
    });
  });

  it('blocks direct session IDs from another opening before get or finalize', async () => {
    const findSession = jest.fn<Promise<unknown>, [PublicSessionQuery]>();
    findSession.mockResolvedValue(null);
    const transaction = jest.fn(
      async (
        callback: (tx: {
          fileUploadSession: { findFirst: typeof findSession };
        }) => Promise<unknown>,
      ) => callback({ fileUploadSession: { findFirst: findSession } }),
    );
    const sessions = {
      fileUploadSession: { findFirst: findSession },
      $transaction: transaction,
    };
    const service = new FileUploadSessionService(
      sessions as never,
      {} as never,
      {} as never,
      storageFeatures as never,
      {} as never,
      {} as never,
    );

    const crossOpeningSession = {
      sessionId: 'session-for-opening-a',
      companyId: opening.companyId,
      jobOpeningId: 'opening-b',
      publicSessionToken: 'session-token-a',
    };

    await expect(
      service.getPublicOpeningSession(crossOpeningSession),
    ).rejects.toMatchObject({ response: { code: 'FILE_NOT_FOUND' } });
    await expect(
      service.finalizePublicOpeningSession(crossOpeningSession),
    ).rejects.toMatchObject({ response: { code: 'FILE_NOT_FOUND' } });

    for (const [query] of findSession.mock.calls) {
      expect(query.where).toEqual(
        expect.objectContaining({
          id: 'session-for-opening-a',
          companyId: opening.companyId,
          jobOpeningId: 'opening-b',
          jobApplicationId: null,
          jobOfferId: null,
          purpose: {
            in: [FileUploadPurpose.CV, FileUploadPurpose.SUPPORTING],
          },
        }),
      );
    }
  });

  it('rejects a direct public session ID when its bearer token is missing or wrong', async () => {
    const sessions = {
      fileUploadSession: {
        findFirst: jest.fn().mockResolvedValue({
          publicSessionTokenHash: hashPublicSessionToken('session-token-a'),
          creatorUserId: null,
        }),
      },
    };
    const service = new FileUploadSessionService(
      sessions as never,
      {} as never,
      {} as never,
      storageFeatures as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.getPublicOpeningSession({
        sessionId: 'session-a',
        companyId: opening.companyId,
        jobOpeningId: opening.id,
      }),
    ).rejects.toMatchObject({ response: { code: 'UPLOAD_SCOPE_MISMATCH' } });
    await expect(
      service.getPublicOpeningSession({
        sessionId: 'session-a',
        companyId: opening.companyId,
        jobOpeningId: opening.id,
        publicSessionToken: 'another-session-token',
      }),
    ).rejects.toMatchObject({ response: { code: 'UPLOAD_SCOPE_MISMATCH' } });
  });

  it('returns a session only when the opening link and public session token both match', async () => {
    const sessionToken = 'session-token-a';
    const sessions = {
      fileUploadSession: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'session-a',
          version: 1,
          status: FileUploadSessionStatus.ISSUED,
          fileObjectId: null,
          publicSessionTokenHash: hashPublicSessionToken(sessionToken),
          creatorUserId: null,
        }),
      },
    };
    const service = new FileUploadSessionService(
      sessions as never,
      {} as never,
      {} as never,
      storageFeatures as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.getPublicOpeningSession({
        sessionId: 'session-a',
        companyId: opening.companyId,
        jobOpeningId: opening.id,
        publicSessionToken: sessionToken,
      }),
    ).resolves.toMatchObject({
      id: 'session-a',
      status: FileUploadSessionStatus.ISSUED,
      allowedActions: ['UPLOAD', 'FINALIZE', 'CANCEL'],
    });
  });
});
