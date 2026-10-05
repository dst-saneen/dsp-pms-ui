import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  FileObjectStatus,
  FileOperationStatus,
  FileUploadPurpose,
  FileUploadSessionStatus,
} from '@prisma/client';

import { FileStorageController } from '../../src/modules/file-storage/file-storage.controller';
import { hashPublicSessionToken } from '../../src/modules/file-storage/file-storage.crypto';
import { FileDownloadService } from '../../src/modules/file-storage/services/file-download.service';
import { OfferSignatureService } from '../../src/modules/file-storage/services/offer-signature.service';
import { FileUploadSessionService } from '../../src/modules/file-storage/services/file-upload-session.service';
import { FileScanWorker } from '../../src/modules/file-storage/workers/file-scan.worker';
import { requestContextStorage } from '../../src/common/context/request-context';

const disabledStorage = new ForbiddenException({
  code: 'FILE_STORAGE_MODULE_NOT_ENABLED',
});

const signedOfferContext = {
  companyId: 'company-a',
  branchId: 'branch-a',
  jobOfferId: 'offer-a',
  jobApplicationId: 'application-a',
  inspectStatus: 'VALID' as const,
  code: 'OFFER_VALID',
  message: 'Offer is available.',
  offerVersion: 1,
  versionNo: 1,
  tokenKind: 'RESPONSE' as const,
  tokenHash: 'token-hash',
};

interface SessionQuery {
  where: Record<string, unknown>;
}

interface MutationInput {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
}

function issuedSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-a',
    companyId: 'company-a',
    branchId: 'branch-a',
    creatorUserId: 'user-a',
    publicSessionTokenHash: null,
    purpose: FileUploadPurpose.EMPLOYEE_DOCUMENT,
    status: FileUploadSessionStatus.ISSUED,
    expiresAt: new Date(Date.now() + 60_000),
    expectedSizeBytes: 3,
    expectedChecksumSha256:
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    declaredMimeType: 'application/pdf',
    quarantineObjectKey: 'qa/company-a/branch-a/quarantine/session-a',
    version: 0,
    fileObjectId: null,
    ...overrides,
  };
}

describe('File Storage existing-session entitlement rechecks', () => {
  function makeService(
    input: {
      session?: Record<string, unknown> | null;
      storageAvailable?: jest.Mock;
    } = {},
  ) {
    const session =
      input.session ??
      issuedSession({
        fileObject: {
          status: FileObjectStatus.CLEAN,
          creatorUserId: 'user-a',
          branchId: 'branch-a',
        },
      });
    const prisma = {
      fileUploadSession: {
        findFirst: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue(session),
      },
      fileObject: { create: jest.fn(), updateMany: jest.fn() },
      fileOperationAttempt: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    const storage = {
      putObjectBytes: jest.fn(),
      createPresignedPut: jest.fn(),
    };
    const features = {
      assertStorageAvailable:
        input.storageAvailable ?? jest.fn().mockResolvedValue(undefined),
      scanWorkerEnabled: jest.fn().mockReturnValue(false),
    };
    const service = new FileUploadSessionService(
      prisma as never,
      storage as never,
      {} as never,
      features as never,
      {} as never,
      { get: jest.fn().mockReturnValue('test') } as never,
    );
    return { service, prisma, storage, features };
  }

  it.each([
    [
      'authenticated proxy PUT',
      ({ service }: ReturnType<typeof makeService>) =>
        service.putAuthenticatedSessionObject({
          sessionId: 'session-a',
          companyId: 'company-a',
          actorUserId: 'user-a',
          body: Buffer.from('abc'),
          contentType: 'application/pdf',
        }),
    ],
    [
      'cancel',
      ({ service }: ReturnType<typeof makeService>) =>
        service.cancelSession('session-a', 'company-a', 'user-a'),
    ],
    [
      'clean-file use',
      ({ service }: ReturnType<typeof makeService>) =>
        service.requireCleanSession({
          sessionId: 'session-a',
          companyId: 'company-a',
          purpose: FileUploadPurpose.EMPLOYEE_DOCUMENT,
          actorUserId: 'user-a',
        }),
    ],
  ])('fails closed for an existing session on %s', async (_name, operation) => {
    const storageAvailable = jest.fn().mockRejectedValue(disabledStorage);
    const harness = makeService({ storageAvailable });

    await expect(operation(harness)).rejects.toBe(disabledStorage);
    expect(storageAvailable).toHaveBeenCalledWith('company-a', 'branch-a');
    expect(harness.storage.putObjectBytes).not.toHaveBeenCalled();
    expect(harness.prisma.fileUploadSession.update).not.toHaveBeenCalled();
  });

  it('fails closed for a public signed-offer proxy PUT after entitlement removal', async () => {
    const sessionToken = 'public-session-token';
    const storageAvailable = jest.fn().mockRejectedValue(disabledStorage);
    const harness = makeService({
      storageAvailable,
      session: issuedSession({
        purpose: FileUploadPurpose.SIGNED_OFFER,
        jobOfferId: 'offer-a',
        creatorUserId: null,
        publicSessionTokenHash: hashPublicSessionToken(sessionToken),
      }),
    });

    await expect(
      harness.service.putPublicSessionObject({
        sessionId: 'session-a',
        companyId: 'company-a',
        jobOfferId: 'offer-a',
        publicSessionToken: sessionToken,
        body: Buffer.from('abc'),
        contentType: 'application/pdf',
      }),
    ).rejects.toBe(disabledStorage);

    expect(harness.storage.putObjectBytes).not.toHaveBeenCalled();
  });

  it('fails closed before a finalized session is read or mutated', async () => {
    const storageAvailable = jest.fn().mockRejectedValue(disabledStorage);
    const harness = makeService({ storageAvailable });
    harness.prisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(harness.prisma),
    );

    await expect(
      harness.service.getSession('session-a', 'company-a', 'user-a'),
    ).rejects.toBe(disabledStorage);
    await expect(
      harness.service.finalizeSession('session-a', 'company-a', 'user-a'),
    ).rejects.toBe(disabledStorage);

    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('binds public offer session reads, finalization, and cancellation to one offer', async () => {
    const findFirst = jest
      .fn<Promise<null>, [SessionQuery]>()
      .mockResolvedValue(null);
    const storageAvailable = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      fileUploadSession: { findFirst },
      $transaction: jest.fn(
        async (
          callback: (tx: {
            fileUploadSession: { findFirst: typeof findFirst };
          }) => Promise<unknown>,
        ) => callback({ fileUploadSession: { findFirst } }),
      ),
    };
    const service = new FileUploadSessionService(
      prisma as never,
      {} as never,
      {} as never,
      {
        assertStorageAvailable: storageAvailable,
        scanWorkerEnabled: jest.fn().mockReturnValue(false),
      } as never,
      {} as never,
      { get: jest.fn().mockReturnValue('test') } as never,
    );

    const crossOffer = {
      sessionId: 'session-for-offer-b',
      companyId: 'company-a',
      jobOfferId: 'offer-a',
      publicSessionToken: 'token-a',
    };

    await expect(
      service.getPublicOfferSession(crossOffer),
    ).rejects.toMatchObject({
      response: { code: 'FILE_NOT_FOUND' },
    });
    await expect(
      service.cancelPublicOfferSession(crossOffer),
    ).rejects.toMatchObject({ response: { code: 'FILE_NOT_FOUND' } });

    // finalize performs a live availability check before its scoped lookup.
    await expect(
      service.finalizePublicOfferSession(crossOffer),
    ).rejects.toMatchObject({ response: { code: 'FILE_NOT_FOUND' } });

    for (const [query] of findFirst.mock.calls) {
      expect(query.where).toEqual(
        expect.objectContaining({
          id: crossOffer.sessionId,
          companyId: crossOffer.companyId,
          jobOfferId: crossOffer.jobOfferId,
          purpose: FileUploadPurpose.SIGNED_OFFER,
        }),
      );
    }
  });
});

describe('Public signed-offer controller binding', () => {
  it('uses the token offer ID for public get, finalize, and cancel routes', async () => {
    const sessions = {
      finalizePublicOfferSession: jest
        .fn()
        .mockResolvedValue({ id: 'session-a' }),
      getPublicOfferSession: jest.fn().mockResolvedValue({ id: 'session-a' }),
      cancelPublicOfferSession: jest
        .fn()
        .mockResolvedValue({ id: 'session-a' }),
    };
    const signatures = {
      assertSignedOfferWorkflowAllowed: jest.fn().mockResolvedValue(undefined),
    };
    const tokens = { resolve: jest.fn().mockResolvedValue(signedOfferContext) };
    const controller = new FileStorageController(
      sessions as never,
      {} as never,
      signatures as never,
      tokens as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await controller.getOfferSession('token-a', 'session-a', 'session-token-a');
    await controller.finalizeOfferSession(
      'token-a',
      'session-a',
      'session-token-a',
    );
    await controller.cancelOfferSession(
      'token-a',
      'session-a',
      'session-token-a',
    );

    expect(signatures.assertSignedOfferWorkflowAllowed).toHaveBeenCalledTimes(
      3,
    );
    for (const service of [
      sessions.getPublicOfferSession,
      sessions.finalizePublicOfferSession,
      sessions.cancelPublicOfferSession,
    ]) {
      expect(service).toHaveBeenCalledWith({
        sessionId: 'session-a',
        companyId: 'company-a',
        jobOfferId: 'offer-a',
        publicSessionToken: 'session-token-a',
      });
    }
  });
});

describe('Staff signed-offer branch scope', () => {
  it('requires the recruitment-domain offer scope before listing submissions', async () => {
    const scopeError = new NotFoundException('Job offer not found');
    const signatures = new OfferSignatureService(
      { offerSignatureSubmission: { findMany: jest.fn() } } as never,
      {} as never,
      {} as never,
      {
        assertSignedOfferWorkflowAllowed: jest
          .fn()
          .mockResolvedValue(undefined),
      } as never,
      {} as never,
      {
        assertJobOfferInScope: jest.fn().mockRejectedValue(scopeError),
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      signatures.getSubmissions('offer-from-another-branch', 'company-a'),
    ).rejects.toBe(scopeError);
  });
});

describe('File download entitlement and branch boundaries', () => {
  function makeDownloads(
    storageAvailable = jest.fn().mockResolvedValue(undefined),
  ) {
    const document = {
      id: 'recruitment-document-a',
      branchId: 'branch-a',
      fileObject: {
        id: 'file-a',
        status: FileObjectStatus.CLEAN,
        objectKey: 'qa/company-a/branch-a/clean/file-a',
        originalFileNameEncrypted: 'ciphertext',
        fileNameEncNonce: 'nonce',
        fileNameEncTag: 'tag',
        fileNameEncKeyVersion: 1,
        safeExtension: 'pdf',
      },
    };
    const employeeDocument = {
      id: 'employee-document-a',
      branchIdAtUpload: 'branch-a',
      fileObject: document.fileObject,
    };
    const prisma = {
      recruitmentDocument: {
        findFirst: jest.fn().mockResolvedValue(document),
      },
      employeeDocument: {
        findFirst: jest.fn().mockResolvedValue(employeeDocument),
      },
    };
    const storage = {
      createPresignedGet: jest.fn().mockResolvedValue({
        url: 'https://example.invalid/file-a',
        expiresAt: new Date('2026-09-18T01:00:00.000Z'),
      }),
    };
    const downloads = new FileDownloadService(
      prisma as never,
      storage as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      { decrypt: jest.fn().mockReturnValue('signed-offer.pdf') } as never,
      { assertStorageAvailable: storageAvailable } as never,
    );
    return { downloads, prisma, storage, storageAvailable };
  }

  it('does not look up or presign a recruitment file after File Storage is disabled', async () => {
    const storageAvailable = jest.fn().mockRejectedValue(disabledStorage);
    const harness = makeDownloads(storageAvailable);

    await expect(
      harness.downloads.grantRecruitmentDocumentDownload(
        'recruitment-document-a',
        'company-a',
        'user-a',
      ),
    ).rejects.toBe(disabledStorage);

    expect(harness.prisma.recruitmentDocument.findFirst).not.toHaveBeenCalled();
    expect(harness.storage.createPresignedGet).not.toHaveBeenCalled();
  });

  it('does not presign a cross-branch recruitment document for a branch-scoped actor', async () => {
    const harness = makeDownloads();

    await requestContextStorage.run(
      {
        requestId: 'request-a',
        activeCompanyId: 'company-a',
        activeBranchId: 'branch-b',
        scopeLevel: 'BRANCH',
        isGlobal: false,
      },
      async () => {
        await expect(
          harness.downloads.grantRecruitmentDocumentDownload(
            'recruitment-document-a',
            'company-a',
            'user-a',
          ),
        ).rejects.toMatchObject({ response: { code: 'FILE_NOT_FOUND' } });
      },
    );

    expect(harness.storage.createPresignedGet).not.toHaveBeenCalled();
  });

  it('does not presign a cross-branch employee document for a branch-scoped actor', async () => {
    const harness = makeDownloads();

    await requestContextStorage.run(
      {
        requestId: 'request-a',
        activeCompanyId: 'company-a',
        activeBranchId: 'branch-b',
        scopeLevel: 'BRANCH',
        isGlobal: false,
      },
      async () => {
        await expect(
          harness.downloads.grantEmployeeDocumentDownload(
            'employee-document-a',
            'company-a',
            'user-a',
          ),
        ).rejects.toMatchObject({ response: { code: 'FILE_NOT_FOUND' } });
      },
    );

    expect(harness.storage.createPresignedGet).not.toHaveBeenCalled();
  });
});

describe('File Scan Worker entitlement rechecks', () => {
  it('does not scan a disabled Company and releases the processing lease', async () => {
    const attempt = {
      id: 'attempt-a',
      fileObject: {
        id: 'file-a',
        companyId: 'company-a',
        branchId: 'branch-a',
        version: 0,
        status: FileObjectStatus.QUARANTINED,
        objectKey: 'qa/company-a/branch-a/quarantine/file-a',
        expectedChecksumSha256: 'checksum-a',
        safeExtension: 'pdf',
      },
    };
    const updateFileObject = jest
      .fn<Promise<{ count: number }>, [MutationInput]>()
      .mockResolvedValue({ count: 1 });
    const updateAttempt = jest
      .fn<Promise<{ count: number }>, [MutationInput]>()
      .mockResolvedValue({ count: 1 });
    const prisma = {
      fileOperationAttempt: {
        findUnique: jest.fn().mockResolvedValue(attempt),
        updateMany: updateAttempt,
      },
      fileObject: {
        updateMany: updateFileObject,
      },
    };
    const scanner = { scanObjectKey: jest.fn() };
    const storage = { copyToClean: jest.fn() };
    const features = {
      isScopeAllowed: jest.fn().mockResolvedValue(false),
      scanWorkerEnabled: jest.fn(),
    };
    const worker = new FileScanWorker(
      prisma as never,
      scanner as never,
      storage as never,
      {} as never,
      features as never,
      {} as never,
    );

    await (
      worker as unknown as { processAttempt(id: string): Promise<void> }
    ).processAttempt('attempt-a');

    expect(scanner.scanObjectKey).not.toHaveBeenCalled();
    expect(storage.copyToClean).not.toHaveBeenCalled();
    expect(updateFileObject.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'file-a', status: FileObjectStatus.SCANNING },
      data: { status: FileObjectStatus.QUARANTINED },
    });
    expect(updateAttempt.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'attempt-a', status: FileOperationStatus.PROCESSING },
      data: {
        status: FileOperationStatus.RETRY_WAIT,
        leaseExpiresAt: null,
        safeErrorCode: 'FILE_STORAGE_MODULE_NOT_ENABLED',
      },
    });
  });

  it('does not promote an object if the Company is disabled while it is scanned', async () => {
    const attempt = {
      id: 'attempt-a',
      fileObject: {
        id: 'file-a',
        companyId: 'company-a',
        branchId: 'branch-a',
        version: 0,
        status: FileObjectStatus.QUARANTINED,
        objectKey: 'qa/company-a/branch-a/quarantine/file-a',
        expectedChecksumSha256: 'checksum-a',
        safeExtension: 'pdf',
      },
    };
    const updateFileObject = jest
      .fn<Promise<{ count: number }>, [MutationInput]>()
      .mockResolvedValue({ count: 1 });
    const updateAttempt = jest
      .fn<Promise<{ count: number }>, [MutationInput]>()
      .mockResolvedValue({ count: 1 });
    const prisma = {
      fileOperationAttempt: {
        findUnique: jest.fn().mockResolvedValue(attempt),
        updateMany: updateAttempt,
      },
      fileObject: {
        updateMany: updateFileObject,
      },
      fileUploadSession: {
        findFirst: jest.fn().mockResolvedValue({
          purpose: FileUploadPurpose.SIGNED_OFFER,
        }),
      },
    };
    const scanner = {
      scanObjectKey: jest.fn().mockResolvedValue({
        failed: false,
        infected: false,
        sha256Hex: 'checksum-a',
        magicBytes: Buffer.from('%PDF'),
        scannedAt: new Date(),
      }),
    };
    const storage = { copyToClean: jest.fn() };
    const features = {
      isScopeAllowed: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      scanWorkerEnabled: jest.fn(),
    };
    const worker = new FileScanWorker(
      prisma as never,
      scanner as never,
      storage as never,
      {
        detect: jest.fn().mockReturnValue('application/pdf'),
        isAllowed: jest.fn().mockReturnValue(true),
      },
      features as never,
      {} as never,
    );

    await (
      worker as unknown as { processAttempt(id: string): Promise<void> }
    ).processAttempt('attempt-a');

    expect(scanner.scanObjectKey).toHaveBeenCalledWith(
      attempt.fileObject.objectKey,
    );
    expect(storage.copyToClean).not.toHaveBeenCalled();
    expect(updateAttempt.mock.calls.at(-1)?.[0]).toMatchObject({
      data: {
        status: FileOperationStatus.RETRY_WAIT,
        safeErrorCode: 'FILE_STORAGE_MODULE_NOT_ENABLED',
      },
    });
  });
});
