import { ForbiddenException } from '@nestjs/common';
import { FileObjectStatus } from '@prisma/client';

import { FileDownloadService } from './file-download.service';

describe('FileDownloadService File Storage entitlement checks', () => {
  const projectDocumentFindFirst = jest.fn();
  const financeAttachmentFindFirst = jest.fn();
  const payslipFindFirst = jest.fn();
  const assertStorageAvailable = jest.fn();
  const createPresignedGet = jest.fn();
  const decrypt = jest.fn();
  const record = jest.fn();

  const createService = () =>
    new FileDownloadService(
      {
        projectDocument: { findFirst: projectDocumentFindFirst },
        financeTransactionAttachment: {
          findFirst: financeAttachmentFindFirst,
        },
        payrollPayslip: { findFirst: payslipFindFirst },
      } as never,
      { createPresignedGet } as never,
      { record } as never,
      { decrypt } as never,
      { assertStorageAvailable } as never,
    );

  const cleanFileObject = (branchId: string | null) => ({
    id: 'file-1',
    status: FileObjectStatus.CLEAN,
    branchId,
    objectKey: 'company-1/file-1',
    originalFileNameEncrypted: 'encrypted-name',
    fileNameEncNonce: 'nonce',
    fileNameEncTag: 'tag',
    fileNameEncKeyVersion: 'active',
    safeExtension: 'pdf',
  });

  const downloadTargets = [
    {
      name: 'project document',
      lookup: projectDocumentFindFirst,
      lateBranchId: null,
      document: () => ({
        id: 'project-document-1',
        fileObject: cleanFileObject(null),
      }),
      download: (service: FileDownloadService) =>
        service.grantProjectDocumentDownload(
          'project-document-1',
          'company-1',
          'project-1',
          'actor-1',
        ),
    },
    {
      name: 'finance attachment',
      lookup: financeAttachmentFindFirst,
      lateBranchId: 'branch-1',
      document: () => ({
        id: 'finance-attachment-1',
        fileObject: cleanFileObject('branch-1'),
      }),
      download: (service: FileDownloadService) =>
        service.grantFinanceAttachmentDownload(
          'finance-attachment-1',
          'company-1',
          'actor-1',
        ),
    },
    {
      name: 'payslip',
      lookup: payslipFindFirst,
      lateBranchId: 'branch-1',
      document: () => ({
        id: 'payslip-1',
        fileObject: cleanFileObject('branch-1'),
      }),
      download: (service: FileDownloadService) =>
        service.grantPayslipDownload('payslip-1', 'company-1', 'actor-1'),
    },
  ] as const;

  beforeEach(() => {
    projectDocumentFindFirst.mockReset();
    financeAttachmentFindFirst.mockReset();
    payslipFindFirst.mockReset();
    assertStorageAvailable.mockReset();
    createPresignedGet.mockReset();
    decrypt.mockReset();
    record.mockReset();
  });

  describe.each(downloadTargets)(
    '$name download',
    ({ lookup, lateBranchId, document, download }) => {
      it('denies before looking up a file when File Storage is disabled', async () => {
        const denial = new ForbiddenException({
          code: 'FILE_STORAGE_MODULE_NOT_ENABLED',
        });
        assertStorageAvailable.mockRejectedValueOnce(denial);

        await expect(download(createService())).rejects.toBe(denial);

        expect(assertStorageAvailable).toHaveBeenCalledTimes(1);
        expect(assertStorageAvailable).toHaveBeenCalledWith('company-1', null);
        expect(lookup).not.toHaveBeenCalled();
        expect(createPresignedGet).not.toHaveBeenCalled();
      });

      it('rechecks File Storage immediately before minting a download URL', async () => {
        const denial = new ForbiddenException({
          code: 'FILE_STORAGE_MODULE_NOT_ENABLED',
        });
        assertStorageAvailable
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(denial);
        lookup.mockResolvedValueOnce(document());
        decrypt.mockReturnValueOnce('download.pdf');

        await expect(download(createService())).rejects.toBe(denial);

        expect(assertStorageAvailable).toHaveBeenCalledTimes(2);
        expect(assertStorageAvailable).toHaveBeenNthCalledWith(
          1,
          'company-1',
          null,
        );
        expect(assertStorageAvailable).toHaveBeenNthCalledWith(
          2,
          'company-1',
          lateBranchId,
        );
        expect(lookup).toHaveBeenCalledTimes(1);
        expect(decrypt).toHaveBeenCalledTimes(1);
        expect(createPresignedGet).not.toHaveBeenCalled();
        expect(record).not.toHaveBeenCalled();
      });
    },
  );
});
