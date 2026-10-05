import { Injectable } from '@nestjs/common';
import { PayrollActionEntityType, PayrollPayslipStatus } from '@prisma/client';
import PDFDocument from 'pdfkit';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { FileDownloadService } from '../../file-storage/services/file-download.service';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';

import type { PayrollAccessContext } from '../payroll-access.types';
import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';
import { PAYROLL_PERMISSIONS } from '../policies/payroll-permissions';
import { PayrollResponseMapper } from './payroll-response.mapper';
import { PayrollScopeService } from './payroll-scope.service';
import { PayrollCommandReceiptService } from './payroll-command-receipt.service';
import type { VersionedReasonCommandDto } from '../dto/versioned-command.dto';
import type {
  ListPayslipOperationsDto,
  PayslipOperationState,
} from '../dto/payslip-operations.dto';

@Injectable()
export class PayrollPayslipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PayrollScopeService,
    private readonly mapper: PayrollResponseMapper,
    private readonly downloads: FileDownloadService,
    private readonly receipts: PayrollCommandReceiptService,
    private readonly outbox: OutboxWriterService,
  ) {}

  async listMine(context: PayrollAccessContext) {
    this.assertSelfRead(context);

    if (!context.employeeId) {
      return [];
    }

    const companyId = context.activeCompanyId;
    if (!companyId) {
      return [];
    }

    await this.scope.assertCompanyScope(companyId);

    const rows = await this.prisma.payrollPayslip.findMany({
      where: {
        companyId,
        employeeId: context.employeeId,
        status: {
          in: [
            PayrollPayslipStatus.AVAILABLE,
            PayrollPayslipStatus.PENDING,
            PayrollPayslipStatus.GENERATING,
            PayrollPayslipStatus.FAILED,
          ],
        },
      },
      include: {
        payrollRun: {
          select: { runNumber: true, currencyCode: true },
        },
        payrollRunEmployee: {
          select: { netSalary: true },
        },
      },
      orderBy: [{ payrollYear: 'desc' }, { payrollMonth: 'desc' }],
    });

    return rows.map((row) => this.mapper.toPayslipSummary(row));
  }

  async findMine(id: string, context: PayrollAccessContext) {
    this.assertSelfRead(context);
    const payslip = await this.loadOwnPayslip(id, context);
    return this.mapper.toPayslipSummary(payslip);
  }

  async createDownloadGrant(
    id: string,
    context: PayrollAccessContext,
    requestId?: string,
  ) {
    this.assertSelfRead(context);
    const payslip = await this.loadOwnPayslip(id, context);

    if (
      payslip.status !== PayrollPayslipStatus.AVAILABLE ||
      !payslip.fileObjectId
    ) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.PAYSLIP_NOT_AVAILABLE,
        'Payslip is not available for download yet.',
      );
    }

    const grant = await this.downloads.grantPayslipDownload(
      payslip.id,
      payslip.companyId,
      context.userId,
      requestId,
    );

    return {
      grantId: payslip.fileObjectId,
      downloadUrl: grant.url,
      expiresAt: grant.expiresAt,
      fileName: grant.fileName,
      fileObjectId: payslip.fileObjectId,
    };
  }

  async generatePayslipPdf(payslipId: string): Promise<Buffer> {
    const payslip = await this.prisma.payrollPayslip.findUnique({
      where: { id: payslipId },
      include: {
        payrollRunEmployee: {
          include: {
            lines: { orderBy: { lineSequence: 'asc' } },
          },
        },
        payrollRun: true,
      },
    });

    if (!payslip) {
      this.scope.notFound('Payslip');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk as Buffer));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Payslip', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Employee: ${payslip.displayName}`);
      doc.text(`Employee code: ${payslip.employeeCode}`);
      doc.text(
        `Period: ${payslip.payrollYear}-${String(payslip.payrollMonth).padStart(2, '0')}`,
      );
      doc.text(`Run: ${payslip.payrollRun.runNumber ?? payslip.payrollRunId}`);
      doc.moveDown();

      const employee = payslip.payrollRunEmployee;
      doc.text(
        `Gross earnings: ${this.scope.decimalToString(employee.grossEarnings)}`,
      );
      doc.text(
        `Total deductions: ${this.scope.decimalToString(employee.totalDeductions)}`,
      );
      doc.text(`Net salary: ${this.scope.decimalToString(employee.netSalary)}`);
      doc.moveDown();

      doc.text('Lines');
      for (const line of employee.lines) {
        doc.text(
          `${line.lineName} (${line.direction}): ${this.scope.decimalToString(line.amount)}`,
        );
      }

      doc.end();
    });
  }

  async listOperations(
    context: PayrollAccessContext,
    query: ListPayslipOperationsDto,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);
    const now = new Date();
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const stateFilter = this.operationsStateFilter(query.state, now);
    const where = {
      companyId,
      ...stateFilter,
    };
    const [total, rows] = await Promise.all([
      this.prisma.payrollPayslip.count({ where }),
      this.prisma.payrollPayslip.findMany({
        where,
        orderBy: [{ status: 'asc' }, { updatedAt: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      items: rows.map((row) => this.toOperationsView(row, now)),
      total,
      page,
      limit,
    };
  }

  retry(
    id: string,
    dto: VersionedReasonCommandDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);
    return this.receipts.execute(
      context,
      companyId,
      'RETRY_PAYSLIP_GENERATION',
      { id, ...dto },
      async (tx) => {
        const payslip = await tx.payrollPayslip.findFirst({
          where: { id, companyId },
          include: { employee: { select: { branchId: true } } },
        });
        if (!payslip) this.scope.notFound('Payslip');
        this.scope.assertExpectedVersion(payslip.version, dto.expectedVersion);
        if (
          payslip.fileObjectId ||
          payslip.status === PayrollPayslipStatus.AVAILABLE
        ) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_STATE_CHANGED,
            'Available Payslips cannot be retried.',
          );
        }
        if (
          payslip.status === PayrollPayslipStatus.GENERATING &&
          payslip.generationLeaseExpiresAt &&
          payslip.generationLeaseExpiresAt > new Date()
        ) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_STATE_CHANGED,
            'Payslip generation is still actively leased.',
          );
        }
        const cas = await tx.payrollPayslip.updateMany({
          where: {
            id,
            companyId,
            version: dto.expectedVersion,
            fileObjectId: null,
            status: {
              in: [
                PayrollPayslipStatus.PENDING,
                PayrollPayslipStatus.FAILED,
                PayrollPayslipStatus.GENERATING,
              ],
            },
          },
          data: {
            status: PayrollPayslipStatus.PENDING,
            generationAttemptCount: 0,
            failureCode: null,
            generationLeaseId: null,
            generationLeaseExpiresAt: null,
            version: { increment: 1 },
          },
        });
        this.scope.assertVersionedUpdate(cas, 'Payslip');
        const updated = await tx.payrollPayslip.findUniqueOrThrow({
          where: { id },
        });
        await this.scope.recordActionEvent(tx, {
          companyId,
          entityType: PayrollActionEntityType.PAYSLIP,
          entityId: id,
          action: 'RETRY',
          actorUserId: context.userId,
          operationId: dto.operationId,
          versionBefore: payslip.version,
          versionAfter: updated.version,
          privateReason: dto.reason.trim(),
        });
        await this.outbox.write(tx, {
          aggregateType: 'PayrollPayslip',
          aggregateId: id,
          eventType: 'payroll.payslip.generate',
          payload: { payslipId: id, companyId },
          dedupeKey: `payroll-payslip-retry:${id}:${dto.operationId}`,
          companyId,
          branchId: payslip.employee.branchId,
        });
        return this.receipts.commandMeta('PAYSLIP', id, {
          version: updated.version,
          status: updated.status,
        });
      },
      () => this.findForOperator(id, context),
    );
  }

  private async loadOwnPayslip(id: string, context: PayrollAccessContext) {
    if (!context.employeeId || !context.activeCompanyId) {
      this.scope.notFound('Payslip');
    }

    await this.scope.assertCompanyScope(context.activeCompanyId);

    const payslip = await this.prisma.payrollPayslip.findFirst({
      where: {
        id,
        companyId: context.activeCompanyId,
        employeeId: context.employeeId,
      },
      include: {
        payrollRun: {
          select: { runNumber: true, currencyCode: true },
        },
        payrollRunEmployee: {
          select: { netSalary: true },
        },
      },
    });

    if (!payslip) {
      this.scope.notFound('Payslip');
    }

    return payslip;
  }

  private async findForOperator(id: string, context: PayrollAccessContext) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);
    const payslip = await this.prisma.payrollPayslip.findFirst({
      where: { id, companyId },
    });
    if (!payslip) this.scope.notFound('Payslip');
    return this.toOperationsView(payslip, new Date());
  }

  private toOperationsView(
    payslip: {
      id: string;
      version: number;
      employeeId: string;
      employeeCode: string;
      displayName: string;
      payrollYear: number;
      payrollMonth: number;
      status: PayrollPayslipStatus;
      generationAttemptCount: number;
      generationLeaseExpiresAt: Date | null;
      lastAttemptAt: Date | null;
      failureCode: string | null;
      updatedAt: Date;
    },
    now: Date,
  ) {
    const operationState = this.toOperationState(payslip, now);
    const activeLease = operationState === 'ACTIVE_GENERATION';
    return {
      id: payslip.id,
      version: payslip.version,
      employeeId: payslip.employeeId,
      employeeCode: payslip.employeeCode,
      displayName: payslip.displayName,
      payrollYear: payslip.payrollYear,
      payrollMonth: payslip.payrollMonth,
      status: payslip.status,
      generationAttemptCount: payslip.generationAttemptCount,
      generationLeaseExpiresAt:
        payslip.generationLeaseExpiresAt?.toISOString() ?? null,
      lastAttemptAt: payslip.lastAttemptAt?.toISOString() ?? null,
      failureCode: payslip.failureCode,
      operationState,
      isDeadLetter: operationState === 'DEAD_LETTER',
      isStale: operationState === 'STALE_GENERATION',
      updatedAt: payslip.updatedAt.toISOString(),
      allowedActions:
        payslip.status === PayrollPayslipStatus.AVAILABLE || activeLease
          ? []
          : ['RETRY'],
    };
  }

  private operationsStateFilter(
    state: PayslipOperationState | undefined,
    now: Date,
  ) {
    if (!state) {
      return {
        status: {
          in: [
            PayrollPayslipStatus.PENDING,
            PayrollPayslipStatus.FAILED,
            PayrollPayslipStatus.GENERATING,
          ],
        },
      };
    }
    switch (state) {
      case 'PENDING':
        return { status: PayrollPayslipStatus.PENDING };
      case 'ACTIVE_GENERATION':
        return {
          status: PayrollPayslipStatus.GENERATING,
          generationLeaseExpiresAt: { gt: now },
        };
      case 'STALE_GENERATION':
        return {
          status: PayrollPayslipStatus.GENERATING,
          OR: [
            { generationLeaseExpiresAt: null },
            { generationLeaseExpiresAt: { lte: now } },
          ],
        };
      case 'DEAD_LETTER':
        return {
          status: PayrollPayslipStatus.FAILED,
          failureCode: 'DEAD_LETTER',
        };
      case 'FAILED':
        return {
          status: PayrollPayslipStatus.FAILED,
          NOT: { failureCode: 'DEAD_LETTER' },
        };
    }
  }

  private toOperationState(
    payslip: {
      status: PayrollPayslipStatus;
      failureCode: string | null;
      generationLeaseExpiresAt: Date | null;
    },
    now: Date,
  ): PayslipOperationState {
    if (payslip.failureCode === 'DEAD_LETTER') return 'DEAD_LETTER';
    if (payslip.status === PayrollPayslipStatus.FAILED) return 'FAILED';
    if (payslip.status === PayrollPayslipStatus.GENERATING) {
      return payslip.generationLeaseExpiresAt &&
        payslip.generationLeaseExpiresAt > now
        ? 'ACTIVE_GENERATION'
        : 'STALE_GENERATION';
    }
    return 'PENDING';
  }

  private assertSelfRead(context: PayrollAccessContext) {
    if (!context.permissions.includes(PAYROLL_PERMISSIONS.SELF_READ)) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
        'Missing payroll self-service permission.',
      );
    }
  }

  private assertManage(context: PayrollAccessContext) {
    if (!context.permissions.includes(PAYROLL_PERMISSIONS.PAYROLL_MANAGE)) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
        'Missing payroll management permission.',
      );
    }
  }
}
