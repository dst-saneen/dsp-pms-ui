import {
  CompanyModuleCode,
  PayrollPayslipStatus,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';

import { GeneratedFileService } from '../../src/modules/file-storage/services/generated-file.service';
import { OutboxWriterService } from '../../src/modules/outbox/outbox-writer.service';
import {
  PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED,
  PayrollPayslipWorkerService,
} from '../../src/modules/payroll/services/payroll-payslip-worker.service';
import { PayrollPayslipsService } from '../../src/modules/payroll/services/payroll-payslips.service';
import { PayrollFeatureService } from '../../src/modules/payroll/services/payroll-feature.service';
import { PayrollScopeService } from '../../src/modules/payroll/services/payroll-scope.service';
import { PAYROLL_ERROR_CODES } from '../../src/modules/payroll/policies/payroll-error-codes';
import { PrismaService } from '../../src/prisma/prisma.service';

const PAYSLIP_ID = 'payslip-1';
const COMPANY_ID = 'company-1';

function paidPayslip() {
  return {
    id: PAYSLIP_ID,
    companyId: COMPANY_ID,
    employeeId: 'employee-1',
    employeeCode: 'EMP-001',
    payrollYear: 2026,
    payrollMonth: 9,
    status: PayrollPayslipStatus.PENDING,
    fileObjectId: null,
    failureCode: null,
    generationAttemptCount: 0,
    payrollRun: {
      statusEnum: PayrollRunStatus.PAID,
      paidByUserId: 'payroll-approver',
      createdByUserId: 'payroll-maker',
    },
    employee: { branchId: 'branch-1' },
  };
}

describe('PayrollPayslipWorkerService entitlement rechecks', () => {
  let prisma: {
    payrollPayslip: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let feature: { isEnabledForCompany: jest.Mock };
  let payslips: { generatePayslipPdf: jest.Mock };
  let generatedFiles: {
    storeCleanGeneratedFile: jest.Mock;
    compensateAfterTransactionFailure: jest.Mock;
  };
  let outbox: { write: jest.Mock };
  let scope: { recordActionEvent: jest.Mock };
  let service: PayrollPayslipWorkerService;

  beforeEach(() => {
    prisma = {
      payrollPayslip: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    feature = { isEnabledForCompany: jest.fn().mockResolvedValue(true) };
    payslips = {
      generatePayslipPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };
    generatedFiles = {
      storeCleanGeneratedFile: jest.fn(),
      compensateAfterTransactionFailure: jest.fn(),
    };
    outbox = { write: jest.fn() };
    scope = { recordActionEvent: jest.fn() };

    service = new PayrollPayslipWorkerService(
      prisma as unknown as PrismaService,
      payslips as unknown as PayrollPayslipsService,
      generatedFiles as unknown as GeneratedFileService,
      outbox as unknown as OutboxWriterService,
      scope as unknown as PayrollScopeService,
      feature as unknown as PayrollFeatureService,
    );
  });

  it('cancels before PDF generation when Payroll was disabled before the queued event runs', async () => {
    feature.isEnabledForCompany.mockResolvedValue(false);
    prisma.payrollPayslip.updateMany.mockResolvedValue({ count: 1 });

    const outcome = await service.processGenerateEvent({
      payslipId: PAYSLIP_ID,
      companyId: COMPANY_ID,
    });

    expect(outcome).toBe(PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED);
    expect(prisma.payrollPayslip.findFirst).not.toHaveBeenCalled();
    expect(prisma.payrollPayslip.updateMany).toHaveBeenCalledWith({
      // Jest asymmetric matchers are intentionally untyped in mock assertions.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: expect.objectContaining({
        id: PAYSLIP_ID,
        companyId: COMPANY_ID,
        fileObjectId: null,
        status: {
          in: [PayrollPayslipStatus.PENDING, PayrollPayslipStatus.FAILED],
        },
      }),
      // Jest asymmetric matchers are intentionally untyped in mock assertions.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        status: PayrollPayslipStatus.FAILED,
        failureCode: PAYROLL_ERROR_CODES.PAYROLL_MODULE_NOT_ENABLED,
        generationLeaseId: null,
        generationLeaseExpiresAt: null,
      }),
    });
    expect(payslips.generatePayslipPdf).not.toHaveBeenCalled();
    expect(generatedFiles.storeCleanGeneratedFile).not.toHaveBeenCalled();
    expect(outbox.write).not.toHaveBeenCalled();
    expect(scope.recordActionEvent).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechecks inside the final transaction and releases a claimed job when Payroll is disabled mid-process', async () => {
    prisma.payrollPayslip.findFirst.mockResolvedValue(paidPayslip());
    prisma.payrollPayslip.updateMany.mockResolvedValue({ count: 1 });

    const tx = {
      payrollPayslip: {
        findFirst: jest.fn().mockResolvedValue({
          id: PAYSLIP_ID,
          companyId: COMPANY_ID,
          generationLeaseId: 'worker-lease',
          status: PayrollPayslipStatus.GENERATING,
          fileObjectId: null,
          version: 2,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      companyModuleEntitlement: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    prisma.$transaction.mockImplementation(
      async (operation: (transaction: typeof tx) => Promise<unknown>) =>
        operation(tx),
    );

    const outcome = await service.processGenerateEvent({
      payslipId: PAYSLIP_ID,
      companyId: COMPANY_ID,
    });

    expect(outcome).toBe(PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED);
    expect(payslips.generatePayslipPdf).toHaveBeenCalledWith(PAYSLIP_ID);
    expect(tx.companyModuleEntitlement.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: COMPANY_ID,
        module: CompanyModuleCode.PAYROLL,
        isEnabled: true,
        company: { isActive: true },
      },
      select: { id: true },
    });
    expect(tx.payrollPayslip.updateMany).toHaveBeenCalledWith({
      // Jest asymmetric matchers are intentionally untyped in mock assertions.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      where: expect.objectContaining({
        id: PAYSLIP_ID,
        companyId: COMPANY_ID,
        status: PayrollPayslipStatus.GENERATING,
        fileObjectId: null,
      }),
      // Jest asymmetric matchers are intentionally untyped in mock assertions.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        status: PayrollPayslipStatus.FAILED,
        failureCode: PAYROLL_ERROR_CODES.PAYROLL_MODULE_NOT_ENABLED,
        generationLeaseId: null,
        generationLeaseExpiresAt: null,
      }),
    });
    expect(generatedFiles.storeCleanGeneratedFile).not.toHaveBeenCalled();
    expect(outbox.write).not.toHaveBeenCalled();
    expect(scope.recordActionEvent).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });
});
