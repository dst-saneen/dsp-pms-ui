import {
  DomainConflictException,
  requestContextStorage,
} from '../../src/common';
import { EmployeeAssetService } from '../../src/modules/employee-asset/employee-asset.service';
import { AssetReturnOutcome } from '../../src/modules/employee-asset/dto/return-asset.dto';
import { EmployeeDocumentService } from '../../src/modules/employee-document/employee-document.service';

describe('release-readiness transaction and concurrency regressions', () => {
  const scope = {
    assetWhere: jest.fn().mockReturnValue({}),
    employeeAssetWhere: jest.fn().mockReturnValue({}),
    documentWhere: jest.fn().mockReturnValue({}),
    documentTypeWhere: jest.fn().mockReturnValue({}),
    assertEmployeeInScope: jest.fn().mockResolvedValue({
      id: 'employee-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      departmentId: 'department-1',
      isActive: true,
      employmentStatus: 'ACTIVE',
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows exactly one concurrent asset assignment to claim AVAILABLE', async () => {
    let assetStatus = 'AVAILABLE';
    const assignments = new Map<string, Record<string, unknown>>();
    let sequence = 0;
    const transaction = {
      asset: {
        updateMany: jest.fn().mockImplementation(() => {
          if (assetStatus !== 'AVAILABLE') {
            return Promise.resolve({ count: 0 });
          }
          assetStatus = 'ASSIGNED';
          return Promise.resolve({ count: 1 });
        }),
      },
      employeeAsset: {
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: Record<string, unknown> }) => {
            const created = { id: `assignment-${++sequence}`, ...data };
            assignments.set(created.id, created);
            return Promise.resolve(created);
          }),
        findUniqueOrThrow: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: string } }) =>
            Promise.resolve(assignments.get(where.id)),
          ),
      },
    };
    const prisma = {
      asset: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asset-1',
          companyId: 'company-1',
          branchId: 'branch-1',
          departmentId: 'department-1',
          status: 'AVAILABLE',
          isActive: true,
        }),
      },
      $transaction: jest.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new EmployeeAssetService(
      prisma as never,
      scope as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
    );

    const results = await Promise.allSettled([
      service.create({
        employeeId: 'employee-1',
        assetId: 'asset-1',
        assignedDate: '2026-08-03',
      }),
      service.create({
        employeeId: 'employee-1',
        assetId: 'asset-1',
        assignedDate: '2026-08-03',
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected?.reason).toMatchObject({ code: 'ASSET_ALREADY_ASSIGNED' });
  });

  it('allows exactly one concurrent asset return to close an assignment', async () => {
    let assignmentStatus = 'ASSIGNED';
    const assignment = {
      id: 'assignment-1',
      employeeId: 'employee-1',
      assetId: 'asset-1',
      status: 'ASSIGNED',
      returnedDate: null,
      employee: { companyId: 'company-1' },
      asset: { id: 'asset-1' },
    };
    const transaction = {
      employeeAsset: {
        updateMany: jest.fn().mockImplementation(() => {
          if (assignmentStatus !== 'ASSIGNED') {
            return Promise.resolve({ count: 0 });
          }
          assignmentStatus = 'RETURNED';
          return Promise.resolve({ count: 1 });
        }),
        findUniqueOrThrow: jest.fn().mockImplementation(() =>
          Promise.resolve({
            ...assignment,
            status: assignmentStatus,
            returnedDate: new Date('2026-08-03'),
          }),
        ),
      },
      asset: {
        update: jest.fn().mockResolvedValue({ id: 'asset-1' }),
      },
    };
    const prisma = {
      employeeAsset: {
        findFirst: jest.fn().mockResolvedValue(assignment),
      },
      $transaction: jest.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new EmployeeAssetService(
      prisma as never,
      scope as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
    );

    const results = await Promise.allSettled([
      service.returnAsset('assignment-1', {
        returnedDate: '2026-08-03',
        outcome: AssetReturnOutcome.RETURNED,
      }),
      service.returnAsset('assignment-1', {
        returnedDate: '2026-08-03',
        outcome: AssetReturnOutcome.RETURNED,
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected?.reason).toBeInstanceOf(DomainConflictException);
    expect(rejected?.reason).toMatchObject({ code: 'ASSET_ALREADY_RETURNED' });
  });

  it('rolls back a document mutation when the audit write fails', async () => {
    const durableDocument = {
      id: 'document-1',
      employeeId: 'employee-1',
      documentTypeId: 'type-1',
      verificationStatus: 'PENDING',
      lifetimeDocument: false,
      expiryDate: null,
    };
    const prisma = {
      employeeDocument: {
        findFirst: jest.fn().mockResolvedValue(durableDocument),
      },
      $transaction: jest.fn(
        async (
          callback: (tx: {
            employeeDocument: {
              update: (
                input: Record<string, unknown>,
              ) => Promise<typeof durableDocument>;
            };
          }) => Promise<unknown>,
        ) => {
          const staged = { ...durableDocument };
          const result = await callback({
            employeeDocument: {
              update: jest.fn().mockImplementation(({ data }) => {
                Object.assign(staged, data);
                return Promise.resolve(staged);
              }),
            },
          });
          Object.assign(durableDocument, staged);
          return result;
        },
      ),
    };
    const service = new EmployeeDocumentService(
      prisma as never,
      scope as never,
      {
        log: jest.fn().mockRejectedValue(new Error('audit unavailable')),
      } as never,
      { requireCleanSession: jest.fn() } as never,
    );

    await requestContextStorage.run(
      { requestId: 'rollback-test', userId: 'auditor-1' },
      async () => {
        await expect(service.verify('document-1', {})).rejects.toThrow(
          'audit unavailable',
        );
      },
    );

    expect(durableDocument.verificationStatus).toBe('PENDING');
  });
});
