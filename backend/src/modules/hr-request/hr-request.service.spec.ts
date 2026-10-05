/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matcher types are intentionally dynamic in these query contract tests. */
import { ForbiddenException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth';

import { HrRequestController } from './hr-request.controller';
import { HrRequestService } from './hr-request.service';

type DecoratorHarness = {
  decorate(request: never, actor: AuthenticatedUser): Record<string, unknown>;
};

describe('HrRequestService response contract', () => {
  const actor: AuthenticatedUser = {
    id: 'actor-user-id',
    username: 'actor',
    employeeId: 'actor-employee-id',
    mustChangePassword: false,
    sessionId: 'session-1',
    authorization: {
      roles: ['EMPLOYEE'],
      permissions: ['hr.self.read'],
      scopeLevel: 'COMPANY',
      isGlobal: false,
      activeCompanyId: 'company-1',
      availableScopes: [],
    },
  };

  function service(
    prisma: Record<string, unknown> = {},
    downloads: Record<string, unknown> = {},
    scope: Record<string, unknown> = {},
  ) {
    return new HrRequestService(
      prisma as never,
      {
        hrRequestWhere: () => ({}),
        employeeWhere: () => ({}),
        ...scope,
      } as never,
      {} as never,
      {} as never,
      downloads as never,
      {
        decrypt: () => 'proof.pdf',
      } as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  function pendingRequest(index: number) {
    return {
      id: `request-${index}`,
      companyId: 'company-1',
      branchId: 'branch-1',
      employeeId: `employee-${index}`,
      requestTypeId: 'type-1',
      requestNo: `HRR-${index}`,
      requestDate: new Date('2026-09-01T00:00:00.000Z'),
      remarks: null,
      fileObjectId: null,
      status: 'PENDING_APPROVAL',
      version: 1,
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      approvedAt: null,
      rejectedAt: null,
      completedAt: null,
      cancelledAt: null,
      branch: { id: 'branch-1', branchCode: 'HQ', branchName: 'Head Office' },
      employee: {
        id: `employee-${index}`,
        employeeCode: `EMP-${index}`,
        firstName: 'Employee',
        lastName: String(index),
        companyId: 'company-1',
        branchId: 'branch-1',
        departmentId: 'department-1',
        managerId: null,
        branch: { id: 'branch-1', branchCode: 'HQ', branchName: 'Head Office' },
        department: {
          id: 'department-1',
          departmentCode: 'OPS',
          departmentName: 'Operations',
        },
        designation: null,
        company: { companyGroupId: 'group-1' },
      },
      requestType: {
        id: 'type-1',
        requestCode: 'GENERAL',
        requestName: 'General',
      },
      fileObject: null,
      approvalTransactionId: `transaction-${index}`,
      approvalTransaction: {
        currentStep: 1,
        status: 'PENDING',
        approvalSteps: [
          {
            stepNo: 1,
            status: 'PENDING',
            approverId: actor.employeeId,
            approver: {
              id: actor.employeeId,
              employeeCode: 'EMP-APPROVER',
              firstName: 'Alex',
              lastName: 'Manager',
            },
          },
        ],
      },
    };
  }

  it('redacts actor, file, and approval-step internals from a request response', () => {
    const result = (service() as unknown as DecoratorHarness).decorate(
      {
        id: 'request-id',
        companyId: 'company-id',
        branchId: 'branch-id',
        employeeId: 'employee-id',
        requestTypeId: 'type-id',
        requestNo: 'HRR-1',
        requestDate: new Date('2026-09-01T00:00:00.000Z'),
        remarks: 'safe request text',
        fileObjectId: 'file-id',
        status: 'PENDING_APPROVAL',
        version: 1,
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
        approvedAt: null,
        rejectedAt: null,
        completedAt: null,
        cancelledAt: null,
        createdByUserId: 'internal-created-by-user-id',
        approvedByUserId: null,
        rejectedByUserId: null,
        completedByUserId: null,
        cancelledByUserId: null,
        cancellationReason: null,
        generatedFilePath: 'legacy-local-path',
        approvalTransactionId: 'transaction-id',
        employee: {
          id: 'employee-id',
          firstName: 'Ada',
          lastName: 'Lovelace',
          employeeCode: 'EMP-1',
          companyId: 'company-id',
          branchId: 'branch-id',
          departmentId: 'department-id',
          managerId: 'manager-id',
          company: { companyGroupId: 'group-id' },
          branch: {
            id: 'branch-id',
            branchCode: 'HQ',
            branchName: 'Head Office',
          },
          department: {
            id: 'department-id',
            departmentCode: 'OPS',
            departmentName: 'Operations',
          },
          designation: {
            id: 'designation-id',
            designationCode: 'OPS_EXEC',
            designationName: 'Operations Executive',
          },
        },
        branch: {
          id: 'branch-id',
          branchCode: 'HQ',
          branchName: 'Head Office',
        },
        requestType: {
          id: 'type-id',
          requestCode: 'LEAVE',
          requestName: 'Leave',
        },
        fileObject: {
          id: 'file-id',
          status: 'CLEAN',
          branchId: 'branch-id',
          safeExtension: 'pdf',
          originalFileNameEncrypted: 'enc',
          fileNameEncNonce: 'nonce',
          fileNameEncTag: 'tag',
          fileNameEncKeyVersion: 1,
        },
        approvalTransaction: {
          status: 'PENDING',
          currentStep: 1,
          approvalSteps: [
            {
              id: 'step-id',
              approverId: 'internal-approver-employee-id',
              status: 'PENDING',
              stepNo: 1,
              approver: {
                id: 'internal-approver-employee-id',
                firstName: 'Alex',
                lastName: 'Manager',
                employeeCode: 'E-1',
              },
            },
          ],
        },
      } as never,
      actor,
    );

    expect(result).toMatchObject({
      id: 'request-id',
      fileObjectId: 'file-id',
      attachment: { present: true, fileName: 'proof.pdf', status: 'CLEAN' },
      branch: {
        id: 'branch-id',
        branchCode: 'HQ',
        branchName: 'Head Office',
      },
      employee: {
        id: 'employee-id',
        firstName: 'Ada',
        lastName: 'Lovelace',
        employeeCode: 'EMP-1',
        department: {
          id: 'department-id',
          departmentCode: 'OPS',
          departmentName: 'Operations',
        },
        designation: {
          id: 'designation-id',
          designationCode: 'OPS_EXEC',
          designationName: 'Operations Executive',
        },
      },
      approvalTransaction: { status: 'PENDING', currentStep: 1 },
      actionRequirements: { expectedVersion: 1 },
    });
    expect(result).not.toHaveProperty('createdByUserId');
    expect(result).not.toHaveProperty('generatedFilePath');
    expect(result).not.toHaveProperty('fileObject');
    expect(result).not.toHaveProperty('approvalTransaction.approvalSteps');
    expect(result).not.toHaveProperty('employee.companyId');
  });

  it('keeps pending-approval filters inside the employee scope and returns requested pagination metadata', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      approvalTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'approval-transaction-1',
            currentStep: 1,
            approvalSteps: [{ stepNo: 1 }],
          },
          {
            id: 'future-approval-transaction',
            currentStep: 1,
            approvalSteps: [{ stepNo: 2 }],
          },
        ]),
      },
      hrRequest: { findMany, count: jest.fn().mockResolvedValue(0) },
    };
    const scopedWhere = {
      OR: [{ companyId: 'company-1' }, { companyId: 'company-2' }],
    };
    const instance = service(prisma, {}, { hrRequestWhere: () => scopedWhere });
    const query = {
      keyword: '  Neha  ',
      branchId: 'branch-2',
      employeeId: 'employee-target',
      requestTypeId: 'request-type-1',
      submittedFrom: '2026-09-01T00:00:00.000Z',
      submittedTo: '2026-09-30',
      page: 2,
      limit: 10,
    };

    const result = await (
      instance as unknown as {
        pendingApprovals: (
          actor: AuthenticatedUser,
          input: typeof query,
        ) => Promise<{ page: number; limit: number; total: number }>;
      }
    ).pendingApprovals(actor, query);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            scopedWhere,
            {
              status: 'PENDING_APPROVAL',
              employeeId: { not: actor.employeeId },
              approvalTransactionId: { in: ['approval-transaction-1'] },
            },
            expect.objectContaining({
              branchId: 'branch-2',
              employeeId: 'employee-target',
              requestTypeId: 'request-type-1',
              createdAt: {
                gte: new Date('2026-09-01T00:00:00.000Z'),
                lt: new Date('2026-10-01T00:00:00.000Z'),
              },
              OR: expect.arrayContaining([
                {
                  requestNo: { contains: 'Neha', mode: 'insensitive' },
                },
                {
                  employee: {
                    employeeCode: { contains: 'Neha', mode: 'insensitive' },
                  },
                },
              ]),
            }),
          ],
        },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ total: 0, page: 2, limit: 10 }),
    );
  });

  it('forwards pending-approval query parameters from the controller', async () => {
    const pendingApprovals = jest.fn().mockResolvedValue({ items: [] });
    const controller = new HrRequestController({ pendingApprovals } as never);
    const query = { page: 2, limit: 10, keyword: 'Neha' };

    await (
      controller as unknown as {
        pendingApprovals: (
          input: typeof query,
          request: { user: AuthenticatedUser },
        ) => Promise<unknown>;
      }
    ).pendingApprovals(query, { user: actor });

    expect(pendingApprovals).toHaveBeenCalledWith(actor, query);
  });

  it('preserves the unpaginated pending queue for callers that omit page and limit', async () => {
    const rows = Array.from({ length: 26 }, (_, index) =>
      pendingRequest(index),
    );
    const findMany = jest.fn((args: { skip?: number; take?: number }) =>
      Promise.resolve(
        args.take
          ? rows.slice(args.skip ?? 0, (args.skip ?? 0) + args.take)
          : rows,
      ),
    );
    const prisma = {
      approvalTransaction: {
        findMany: jest.fn().mockResolvedValue(
          rows.map((row) => ({
            id: row.approvalTransactionId,
            currentStep: 1,
            approvalSteps: row.approvalTransaction.approvalSteps,
          })),
        ),
      },
      hrRequest: {
        findMany,
        count: jest.fn().mockResolvedValue(rows.length),
      },
    };
    const instance = service(prisma);

    const unpaginated = await instance.pendingApprovals(actor);
    const paginated = await instance.pendingApprovals(actor, {
      page: 2,
      limit: 10,
    });

    expect(unpaginated.items).toHaveLength(26);
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty('skip');
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty('take');
    expect(findMany.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(paginated.items).toHaveLength(10);
    expect(paginated).toEqual(
      expect.objectContaining({ total: 26, page: 2, limit: 10 }),
    );
  });

  it('does not advertise CREATE to a stale or inactive actor employee', async () => {
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue(null) },
      hrRequest: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const result = await service(prisma).findAll({ page: 1, limit: 25 }, actor);

    expect(result.allowedActions).toEqual([]);
  });

  it('grants an attachment only to the requester, current approver, or scoped HR reader', async () => {
    const downloads = {
      grantHrRequestAttachmentDownload: jest
        .fn()
        .mockResolvedValue({ url: 'https://example.test/grant' }),
    };
    const prisma = {
      hrRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'request-1',
          companyId: 'company-1',
          employeeId: 'employee-requester',
          fileObjectId: 'file-1',
          approvalTransaction: {
            currentStep: 2,
            approvalSteps: [
              { stepNo: 2, status: 'PENDING', approverId: 'employee-approver' },
            ],
          },
        }),
      },
    };
    const instance = service(prisma, downloads);

    await expect(
      instance.createAttachmentDownloadGrant('request-1', {
        ...actor,
        employeeId: 'employee-requester',
      }),
    ).resolves.toEqual({ url: 'https://example.test/grant' });
    await expect(
      instance.createAttachmentDownloadGrant('request-1', {
        ...actor,
        employeeId: 'employee-approver',
      }),
    ).resolves.toEqual({ url: 'https://example.test/grant' });
    await expect(
      instance.createAttachmentDownloadGrant('request-1', {
        ...actor,
        employeeId: 'employee-unrelated',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(downloads.grantHrRequestAttachmentDownload).toHaveBeenCalledWith(
      'request-1',
      'company-1',
      'actor-user-id',
      undefined,
    );
  });
});
