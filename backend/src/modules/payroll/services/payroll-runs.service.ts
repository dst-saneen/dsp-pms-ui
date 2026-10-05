import { Injectable } from '@nestjs/common';
import {
  PayrollActionEntityType,
  PayrollLineSource,
  PayrollPayslipStatus,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';

import { DomainConflictException, csvEscapeCell } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NumberSeriesService } from '../../number-series';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';
import { PayrollExpenseService } from '../../office-finance/services/payroll-expense.service';

import {
  ApprovePayrollRunDto,
  CalculatePayrollRunDto,
  CancelPayrollRunDto,
  CreatePayrollAdjustmentDto,
  CreatePayrollRunDto,
  MarkPayrollPaidDto,
  RemovePayrollAdjustmentDto,
  ReturnPayrollToDraftDto,
  SearchPayrollRunDto,
  UpdatePayrollAdjustmentDto,
} from '../dto/payroll-run.dto';
import type { PayrollAccessContext } from '../payroll-access.types';
import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';
import { PAYROLL_PERMISSIONS } from '../policies/payroll-permissions';
import { PayrollCalculationService } from './payroll-calculation.service';
import { PayrollCapabilityService } from './payroll-capability.service';
import { PayrollCommandReceiptService } from './payroll-command-receipt.service';
import { PayrollPreflightService } from './payroll-preflight.service';
import { PayrollResponseMapper } from './payroll-response.mapper';
import { PayrollScopeService } from './payroll-scope.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class PayrollRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PayrollScopeService,
    private readonly receipts: PayrollCommandReceiptService,
    private readonly preflight: PayrollPreflightService,
    private readonly calculation: PayrollCalculationService,
    private readonly capabilities: PayrollCapabilityService,
    private readonly mapper: PayrollResponseMapper,
    private readonly numberSeries: NumberSeriesService,
    private readonly payrollExpense: PayrollExpenseService,
    private readonly outbox: OutboxWriterService,
  ) {}

  async findPage(query: SearchPayrollRunDto, context: PayrollAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const where: Prisma.PayrollRunWhereInput = {
      companyId,
      ...(query.year ? { payrollYear: query.year } : {}),
      ...(query.month ? { payrollMonth: query.month } : {}),
      ...(query.status
        ? {
            OR: [
              { status: query.status },
              { statusEnum: query.status as PayrollRunStatus },
            ],
          }
        : {}),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [rows, total] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where,
        orderBy: [{ payrollYear: 'desc' }, { payrollMonth: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payrollRun.count({ where }),
    ]);

    const items = await Promise.all(
      rows.map(async (run) => {
        try {
          const preflight = await this.preflight.evaluate(
            companyId,
            run.payrollYear,
            run.payrollMonth,
            run.id,
          );
          return this.mapper.toRunProjection(
            run,
            context,
            preflight.blockers,
            preflight.warnings,
          );
        } catch {
          return this.mapper.toRunProjection(
            run,
            context,
            [this.preflightUnavailableBlocker()],
            [],
          );
        }
      }),
    );

    return this.mapper.toPaginated(items, total, page, limit);
  }

  async findOne(id: string, context: PayrollAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const run = await this.loadRun(id, companyId);
    try {
      const preflight = await this.preflight.evaluate(
        companyId,
        run.payrollYear,
        run.payrollMonth,
        run.id,
      );

      return this.mapper.toRunProjection(
        run,
        context,
        preflight.blockers,
        preflight.warnings,
      );
    } catch {
      return this.mapper.toRunProjection(
        run,
        context,
        [this.preflightUnavailableBlocker()],
        [],
      );
    }
  }

  async getPreflight(
    year: number,
    month: number,
    context: PayrollAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);
    return this.preflight.evaluate(companyId, year, month);
  }

  private preflightUnavailableBlocker() {
    return {
      code: PAYROLL_ERROR_CODES.PAYROLL_PREFLIGHT_FAILED,
      message:
        'Payroll readiness could not be checked. Retry before calculating or processing this run.',
    };
  }

  create(dto: CreatePayrollRunDto, context: PayrollAccessContext) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'CREATE_PAYROLL_RUN',
      dto,
      async (tx) => {
        await this.scope.assertCompanyScope(companyId);

        const preflight = await this.preflight.evaluate(
          companyId,
          dto.year,
          dto.month,
          undefined,
          tx,
        );
        this.preflight.assertNoBlockers(preflight);

        const existing = await tx.payrollRun.findFirst({
          where: {
            companyId,
            payrollYear: dto.year,
            payrollMonth: dto.month,
            statusEnum: { not: PayrollRunStatus.CANCELLED },
          },
        });

        if (existing) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_PERIOD_EXISTS,
            'Payroll run already exists for this Company and month.',
          );
        }

        const profile = await tx.companyFinancialProfile.findUnique({
          where: { companyId },
        });

        if (!profile?.baseCurrencyCode) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_FINANCE_SETUP_REQUIRED,
            'Company financial profile is not configured.',
          );
        }

        const { periodStart, periodEnd } = this.scope.getPeriodBounds(
          dto.year,
          dto.month,
        );

        const runNumber = await this.numberSeries.next(
          'PAYROLL_RUN',
          companyId,
          'PR',
          6,
          tx,
        );

        let created: { id: string; version: number };
        try {
          created = await tx.payrollRun.create({
            data: {
              companyId,
              payrollYear: dto.year,
              payrollMonth: dto.month,
              runNumber,
              periodStart,
              periodEnd,
              currencyCode: profile.baseCurrencyCode,
              status: 'DRAFT',
              statusEnum: PayrollRunStatus.DRAFT,
              remarks: dto.remarks?.trim() || null,
              createdByUserId: context.userId,
              totalEarnings: new Prisma.Decimal(0),
              totalDeductions: new Prisma.Decimal(0),
              totalNet: new Prisma.Decimal(0),
            },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            throw new DomainConflictException(
              PAYROLL_ERROR_CODES.PAYROLL_PERIOD_EXISTS,
              'Payroll run already exists for this Company and month.',
            );
          }
          throw error;
        }

        await this.recordRunEvent(
          tx,
          companyId,
          created.id,
          'CREATE',
          'DRAFT',
          'DRAFT',
          0,
          created.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('PAYROLL_RUN', created.id);
      },
      (id) => this.findOne(id, context),
    );
  }

  createAdjustment(
    runId: string,
    dto: CreatePayrollAdjustmentDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'CREATE_PAYROLL_ADJUSTMENT',
      { ...dto, runId },
      async (tx) => {
        const run = await this.loadRunForCommand(
          tx,
          runId,
          companyId,
          dto.expectedVersion,
          'DRAFT',
        );
        await this.assertEmployeeEligible(
          tx,
          companyId,
          dto.employeeId,
          run.payrollYear,
          run.payrollMonth,
        );

        if (dto.sourceId) {
          await this.assertSourceAvailable(
            tx,
            companyId,
            dto.sourceType,
            dto.sourceId,
            runId,
          );
        }

        const amount = this.scope.parseMoney(dto.amount, 'amount');
        if (amount.lessThanOrEqualTo(0)) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.VALIDATION_ERROR,
            'Adjustment amount must be positive.',
          );
        }

        await this.claimDraftRunMutation(tx, run);

        const created = await tx.payrollRunAdjustment.create({
          data: {
            companyId,
            payrollRunId: runId,
            employeeId: dto.employeeId,
            direction: dto.direction,
            sourceType: dto.sourceType,
            sourceId: dto.sourceId ?? null,
            amount,
            reason: dto.reason.trim(),
            createdByUserId: context.userId,
          },
        });

        await this.scope.recordActionEvent(tx, {
          companyId,
          entityType: PayrollActionEntityType.PAYROLL_ADJUSTMENT,
          entityId: created.id,
          action: 'CREATE',
          actorUserId: context.userId,
          operationId: dto.operationId,
          versionBefore: 0,
          versionAfter: created.version,
        });

        return this.receipts.commandMeta('PAYROLL_ADJUSTMENT', created.id);
      },
      () => this.findOne(runId, context),
    );
  }

  updateAdjustment(
    runId: string,
    adjustmentId: string,
    dto: UpdatePayrollAdjustmentDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'UPDATE_PAYROLL_ADJUSTMENT',
      { ...dto, runId, adjustmentId },
      async (tx) => {
        const run = await this.loadRunForCommand(
          tx,
          runId,
          companyId,
          dto.expectedVersion,
          'DRAFT',
        );

        const adjustment = await tx.payrollRunAdjustment.findFirst({
          where: { id: adjustmentId, payrollRunId: runId, companyId },
        });

        if (!adjustment || adjustment.archivedAt || adjustment.cancelledAt) {
          this.scope.notFound('Payroll adjustment');
        }

        await this.claimDraftRunMutation(tx, run);

        const adjustmentCas = await tx.payrollRunAdjustment.updateMany({
          where: {
            id: adjustmentId,
            payrollRunId: runId,
            companyId,
            version: adjustment.version,
            archivedAt: null,
            cancelledAt: null,
          },
          data: {
            amount: dto.amount
              ? this.scope.parseMoney(dto.amount, 'amount')
              : adjustment.amount,
            reason: dto.reason?.trim() ?? adjustment.reason,
            version: { increment: 1 },
            updatedByUserId: context.userId,
          },
        });
        this.scope.assertVersionedUpdate(adjustmentCas, 'Payroll adjustment');
        const updated = await tx.payrollRunAdjustment.findUniqueOrThrow({
          where: { id: adjustmentId },
        });

        await this.scope.recordActionEvent(tx, {
          companyId,
          entityType: PayrollActionEntityType.PAYROLL_ADJUSTMENT,
          entityId: updated.id,
          action: 'UPDATE',
          actorUserId: context.userId,
          operationId: dto.operationId,
          versionBefore: adjustment.version,
          versionAfter: updated.version,
        });

        return this.receipts.commandMeta('PAYROLL_ADJUSTMENT', updated.id);
      },
      () => this.findOne(runId, context),
    );
  }

  removeAdjustment(
    runId: string,
    adjustmentId: string,
    dto: RemovePayrollAdjustmentDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'REMOVE_PAYROLL_ADJUSTMENT',
      { ...dto, runId, adjustmentId },
      async (tx) => {
        const run = await this.loadRunForCommand(
          tx,
          runId,
          companyId,
          dto.expectedVersion,
          'DRAFT',
        );

        const adjustment = await tx.payrollRunAdjustment.findFirst({
          where: { id: adjustmentId, payrollRunId: runId, companyId },
        });

        if (!adjustment || adjustment.archivedAt || adjustment.cancelledAt) {
          this.scope.notFound('Payroll adjustment');
        }

        await this.claimDraftRunMutation(tx, run);

        const adjustmentCas = await tx.payrollRunAdjustment.updateMany({
          where: {
            id: adjustmentId,
            payrollRunId: runId,
            companyId,
            version: adjustment.version,
            archivedAt: null,
            cancelledAt: null,
          },
          data: {
            archivedAt: new Date(),
            archivedByUserId: context.userId,
            archiveReason: 'Removed from draft run',
            version: { increment: 1 },
          },
        });
        this.scope.assertVersionedUpdate(adjustmentCas, 'Payroll adjustment');
        const updated = await tx.payrollRunAdjustment.findUniqueOrThrow({
          where: { id: adjustmentId },
        });

        await this.scope.recordActionEvent(tx, {
          companyId,
          entityType: PayrollActionEntityType.PAYROLL_ADJUSTMENT,
          entityId: updated.id,
          action: 'REMOVE',
          actorUserId: context.userId,
          operationId: dto.operationId,
          versionBefore: adjustment.version,
          versionAfter: updated.version,
        });

        return this.receipts.commandMeta('PAYROLL_ADJUSTMENT', updated.id);
      },
      () => this.findOne(runId, context),
    );
  }

  calculate(
    runId: string,
    dto: CalculatePayrollRunDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'CALCULATE_PAYROLL_RUN',
      { ...dto, runId },
      async (tx) => {
        const run = await this.loadRunForCommand(
          tx,
          runId,
          companyId,
          dto.expectedVersion,
          'DRAFT',
        );
        const { periodStart, periodEnd } = this.scope.getPeriodBounds(
          run.payrollYear,
          run.payrollMonth,
        );

        const calculated = await this.calculation.calculateWithinTransaction(
          tx,
          {
            companyId,
            payrollRunId: runId,
            year: run.payrollYear,
            month: run.payrollMonth,
            periodStart,
            periodEnd,
            actorUserId: context.userId,
            operationId: dto.operationId,
            expectedVersion: run.version,
          },
        );

        await this.recordRunEvent(
          tx,
          companyId,
          runId,
          'CALCULATE',
          'DRAFT',
          'CALCULATED',
          run.version,
          calculated.versionAfter,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('PAYROLL_RUN', runId);
      },
      (id) => this.findOne(id, context),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 120_000,
      },
    );
  }

  returnToDraft(
    runId: string,
    dto: ReturnPayrollToDraftDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'RETURN_PAYROLL_TO_DRAFT',
      { ...dto, runId },
      async (tx) => {
        const run = await this.loadRunForCommand(
          tx,
          runId,
          companyId,
          dto.expectedVersion,
          'CALCULATED',
        );

        const versionAfter = run.version + 1;
        const cas = await tx.payrollRun.updateMany({
          where: {
            id: runId,
            companyId,
            version: run.version,
            statusEnum: PayrollRunStatus.CALCULATED,
          },
          data: {
            status: 'DRAFT',
            statusEnum: PayrollRunStatus.DRAFT,
            totalEarnings: new Prisma.Decimal(0),
            totalDeductions: new Prisma.Decimal(0),
            totalNet: new Prisma.Decimal(0),
            calculatedByUserId: null,
            calculatedAt: null,
            version: versionAfter,
          },
        });

        if (cas.count !== 1) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_RUN_STATE_CHANGED,
            'Payroll run state changed during return-to-draft.',
          );
        }

        await this.calculation.clearSnapshots(tx, runId, companyId);

        await this.recordRunEvent(
          tx,
          companyId,
          runId,
          'RETURN_TO_DRAFT',
          'CALCULATED',
          'DRAFT',
          run.version,
          versionAfter,
          dto.operationId,
          context.userId,
          dto.reason,
        );

        return this.receipts.commandMeta('PAYROLL_RUN', runId);
      },
      (id) => this.findOne(id, context),
    );
  }

  approve(
    runId: string,
    dto: ApprovePayrollRunDto,
    context: PayrollAccessContext,
  ) {
    this.assertApprove(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'APPROVE_PAYROLL_RUN',
      { ...dto, runId },
      async (tx) => {
        const run = await this.loadRunForCommand(
          tx,
          runId,
          companyId,
          dto.expectedVersion,
          'CALCULATED',
        );

        if (!this.capabilities.canApproveRun(run, context)) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_SELF_APPROVAL_FORBIDDEN,
            'Payroll run creator or calculator cannot approve this run.',
          );
        }

        const employees = await tx.payrollRunEmployee.findMany({
          where: { payrollRunId: runId, companyId },
          include: { lines: true },
        });

        let earnings = new Prisma.Decimal(0);
        let deductions = new Prisma.Decimal(0);
        for (const employee of employees) {
          const employeeDeductions =
            employee.totalDeductions ?? new Prisma.Decimal(0);
          earnings = earnings.add(employee.grossEarnings);
          deductions = deductions.add(employeeDeductions);
          const lineEarnings = employee.lines
            .filter((line) => line.direction === 'EARNING')
            .reduce((sum, line) => sum.add(line.amount), new Prisma.Decimal(0));
          const lineDeductions = employee.lines
            .filter((line) => line.direction === 'DEDUCTION')
            .reduce((sum, line) => sum.add(line.amount), new Prisma.Decimal(0));
          if (
            !lineEarnings.equals(employee.grossEarnings) ||
            !lineDeductions.equals(employeeDeductions) ||
            !employee.netSalary.equals(
              employee.grossEarnings.sub(employeeDeductions),
            )
          ) {
            throw new DomainConflictException(
              PAYROLL_ERROR_CODES.PAYROLL_STATE_CHANGED,
              'Payroll employee snapshot totals are inconsistent with lines.',
            );
          }
        }

        const expectedNet = earnings.sub(deductions);
        if (
          !earnings.equals(run.totalEarnings ?? new Prisma.Decimal(0)) ||
          !deductions.equals(run.totalDeductions ?? new Prisma.Decimal(0)) ||
          !expectedNet.equals(run.totalNet ?? new Prisma.Decimal(0))
        ) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_STATE_CHANGED,
            'Payroll run totals no longer match employee snapshots.',
          );
        }

        const versionAfter = run.version + 1;
        const cas = await tx.payrollRun.updateMany({
          where: {
            id: runId,
            companyId,
            version: run.version,
            statusEnum: PayrollRunStatus.CALCULATED,
          },
          data: {
            status: 'APPROVED',
            statusEnum: PayrollRunStatus.APPROVED,
            approvedByUserId: context.userId,
            approvedAt: new Date(),
            version: versionAfter,
          },
        });

        if (cas.count !== 1) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_RUN_STATE_CHANGED,
            'Payroll run state changed during approval.',
          );
        }

        await this.recordRunEvent(
          tx,
          companyId,
          runId,
          'APPROVE',
          'CALCULATED',
          'APPROVED',
          run.version,
          versionAfter,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('PAYROLL_RUN', runId);
      },
      (id) => this.findOne(id, context),
    );
  }

  markPaid(
    runId: string,
    dto: MarkPayrollPaidDto,
    context: PayrollAccessContext,
  ) {
    this.assertApprove(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'MARK_PAYROLL_PAID',
      { ...dto, runId },
      async (tx) => {
        const run = await this.loadRunForCommand(
          tx,
          runId,
          companyId,
          dto.expectedVersion,
          'APPROVED',
        );

        if (!run.approvedByUserId || !run.createdByUserId) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_STATE_CHANGED,
            'Payroll run is missing approval evidence.',
          );
        }

        const paidDate = this.scope.parseDate(dto.paidDate, 'paidDate');
        const aggregateNet = this.scope.decimalToString(run.totalNet);

        const financeTransaction =
          await this.payrollExpense.createPayrollExpenseWithinTransaction(tx, {
            companyId,
            payrollRunId: runId,
            payrollRunNumber: run.runNumber ?? runId,
            payrollPeriodStart: this.scope.formatDate(
              run.periodStart ?? paidDate,
            ),
            paidDate: dto.paidDate,
            aggregateNetAmount: aggregateNet,
            paymentAccountId: dto.paymentAccountId,
            payrollCreatorUserId: run.createdByUserId,
            payrollApproverUserId: run.approvedByUserId,
            recordedByUserId: context.userId,
            operationContext: { operationId: dto.operationId },
          });

        const versionAfter = run.version + 1;
        const cas = await tx.payrollRun.updateMany({
          where: {
            id: runId,
            companyId,
            version: run.version,
            statusEnum: PayrollRunStatus.APPROVED,
          },
          data: {
            status: 'PAID',
            statusEnum: PayrollRunStatus.PAID,
            paidByUserId: context.userId,
            paidAt: new Date(),
            paymentAccountId: dto.paymentAccountId,
            paymentReference: dto.paymentReference.trim(),
            financeTransactionId: financeTransaction.id,
            version: versionAfter,
          },
        });

        if (cas.count !== 1) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_RUN_STATE_CHANGED,
            'Payroll run state changed during mark-paid.',
          );
        }

        const employees = await tx.payrollRunEmployee.findMany({
          where: { payrollRunId: runId, companyId },
        });

        for (const employeeRow of employees) {
          const payslip = await tx.payrollPayslip.create({
            data: {
              companyId,
              payrollRunId: runId,
              payrollRunEmployeeId: employeeRow.id,
              employeeId: employeeRow.employeeId,
              employeeCode: employeeRow.employeeCode ?? '',
              displayName: employeeRow.displayName ?? '',
              payrollYear: run.payrollYear,
              payrollMonth: run.payrollMonth,
              status: PayrollPayslipStatus.PENDING,
            },
          });

          await this.outbox.write(tx, {
            aggregateType: 'PayrollPayslip',
            aggregateId: payslip.id,
            eventType: 'payroll.payslip.generate',
            payload: {
              companyId,
              employeeId: employeeRow.employeeId,
            },
            dedupeKey: `payroll-payslip-generate:${payslip.id}`,
            companyId,
          });

          await this.scope.recordActionEvent(tx, {
            companyId,
            entityType: PayrollActionEntityType.PAYSLIP,
            entityId: payslip.id,
            action: 'PENDING',
            actorUserId: context.userId,
            // Unique per payslip: PayrollActionEvent is unique on
            // (companyId, operationId, entityType, action).
            operationId: `${dto.operationId}:${payslip.id}`,
            versionBefore: 0,
            versionAfter: payslip.version,
          });
        }

        await this.recordRunEvent(
          tx,
          companyId,
          runId,
          'MARK_PAID',
          'APPROVED',
          'PAID',
          run.version,
          versionAfter,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('PAYROLL_RUN', runId);
      },
      (id) => this.findOne(id, context),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  cancel(
    runId: string,
    dto: CancelPayrollRunDto,
    context: PayrollAccessContext,
  ) {
    this.assertManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'CANCEL_PAYROLL_RUN',
      { ...dto, runId },
      async (tx) => {
        const run = await tx.payrollRun.findFirst({
          where: { id: runId, companyId },
        });

        if (!run) {
          this.scope.notFound('Payroll run');
        }

        this.scope.assertExpectedVersion(run.version, dto.expectedVersion);

        const status = this.scope.mapRunStatus(run.status, run.statusEnum);
        if (status === 'PAID' || status === 'LEGACY_IMPORTED') {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_STATE_CHANGED,
            'Paid or imported payroll runs cannot be cancelled.',
          );
        }

        const versionAfter = run.version + 1;
        const cas = await tx.payrollRun.updateMany({
          where: {
            id: runId,
            companyId,
            version: run.version,
            statusEnum: run.statusEnum ?? undefined,
            status: run.status,
          },
          data: {
            status: 'CANCELLED',
            statusEnum: PayrollRunStatus.CANCELLED,
            cancelledByUserId: context.userId,
            cancelledAt: new Date(),
            cancellationReason: dto.reason,
            version: versionAfter,
          },
        });

        if (cas.count !== 1) {
          throw new DomainConflictException(
            PAYROLL_ERROR_CODES.PAYROLL_RUN_STATE_CHANGED,
            'Payroll run state changed during cancel.',
          );
        }

        await this.recordRunEvent(
          tx,
          companyId,
          runId,
          'CANCEL',
          status,
          'CANCELLED',
          run.version,
          versionAfter,
          dto.operationId,
          context.userId,
          dto.reason,
        );

        return this.receipts.commandMeta('PAYROLL_RUN', runId);
      },
      (id) => this.findOne(id, context),
    );
  }

  async findEmployees(runId: string, context: PayrollAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);
    await this.loadRun(runId, companyId);

    const rows = await this.prisma.payrollRunEmployee.findMany({
      where: { payrollRunId: runId, companyId },
      include: { lines: { orderBy: { lineSequence: 'asc' } } },
      orderBy: { displayName: 'asc' },
    });

    return rows.map((row) => this.mapper.toRunEmployee(row));
  }

  async findEmployee(
    runId: string,
    employeeId: string,
    context: PayrollAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);
    await this.loadRun(runId, companyId);

    const row = await this.prisma.payrollRunEmployee.findFirst({
      where: { payrollRunId: runId, companyId, employeeId },
      include: { lines: { orderBy: { lineSequence: 'asc' } } },
    });

    if (!row) {
      this.scope.notFound('Payroll run employee');
    }

    return this.mapper.toRunEmployee(row);
  }

  async findHistory(runId: string, context: PayrollAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);
    await this.loadRun(runId, companyId);

    const events = await this.prisma.payrollActionEvent.findMany({
      where: {
        companyId,
        entityType: PayrollActionEntityType.PAYROLL_RUN,
        entityId: runId,
      },
      orderBy: { createdAt: 'asc' },
    });

    return events.map((event) => ({
      id: event.id,
      action: event.action,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorUserId: event.actorUserId,
      versionBefore: event.versionBefore,
      versionAfter: event.versionAfter,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  async buildRegisterCsv(
    runId: string,
    context: PayrollAccessContext,
  ): Promise<string> {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);
    const run = await this.loadRun(runId, companyId);

    const rows = await this.prisma.payrollRunEmployee.findMany({
      where: { payrollRunId: runId, companyId },
      orderBy: { employeeCode: 'asc' },
    });

    const header = [
      'runNumber',
      'year',
      'month',
      'employeeCode',
      'displayName',
      'grossEarnings',
      'totalDeductions',
      'netSalary',
    ].join(',');

    const lines = rows.map((row) =>
      [
        csvEscapeCell(run.runNumber ?? ''),
        run.payrollYear,
        run.payrollMonth,
        csvEscapeCell(row.employeeCode ?? ''),
        csvEscapeCell(row.displayName ?? ''),
        this.scope.decimalToString(row.grossEarnings),
        this.scope.decimalToString(row.totalDeductions),
        this.scope.decimalToString(row.netSalary),
      ].join(','),
    );

    return [header, ...lines].join('\n');
  }

  private async loadRun(id: string, companyId: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, companyId },
    });

    if (!run) {
      this.scope.notFound('Payroll run');
    }

    return run;
  }

  private async loadRunForCommand(
    tx: DbClient,
    runId: string,
    companyId: string,
    expectedVersion: number,
    requiredStatus: PayrollRunStatus,
  ) {
    await tx.$queryRaw`
      SELECT 1 FROM "PayrollRun"
      WHERE id = ${runId} AND "companyId" = ${companyId}
      FOR UPDATE
    `;

    const run = await tx.payrollRun.findFirst({
      where: { id: runId, companyId },
    });

    if (!run) {
      this.scope.notFound('Payroll run');
    }

    this.scope.assertExpectedVersion(run.version, expectedVersion);

    const status = this.scope.mapRunStatus(run.status, run.statusEnum);
    if (status !== requiredStatus) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.PAYROLL_STATE_CHANGED,
        `Payroll run must be ${requiredStatus}.`,
      );
    }

    return run;
  }

  private async claimDraftRunMutation(
    tx: DbClient,
    run: { id: string; companyId: string; version: number },
  ) {
    const cas = await tx.payrollRun.updateMany({
      where: {
        id: run.id,
        companyId: run.companyId,
        version: run.version,
        statusEnum: 'DRAFT',
      },
      data: { version: { increment: 1 } },
    });
    this.scope.assertVersionedUpdate(cas, 'Payroll run');
  }

  private async assertEmployeeEligible(
    tx: DbClient,
    companyId: string,
    employeeId: string,
    year: number,
    month: number,
  ) {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, companyId },
    });

    if (!employee) {
      this.scope.notFound('Employee');
    }

    const { periodStart, periodEnd } = this.scope.getPeriodBounds(year, month);
    const salary = await this.preflight.findEffectiveSalary(
      tx,
      companyId,
      employeeId,
      periodStart,
      periodEnd,
    );

    if (!salary) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
        'Employee is not eligible for this payroll period.',
      );
    }
  }

  private async assertSourceAvailable(
    tx: DbClient,
    companyId: string,
    sourceType: PayrollLineSource,
    sourceId: string,
    runId: string,
  ) {
    const existing = await tx.payrollRunAdjustment.findFirst({
      where: {
        companyId,
        sourceType,
        sourceId,
        archivedAt: null,
        cancelledAt: null,
        payrollRun: {
          statusEnum: { not: PayrollRunStatus.CANCELLED },
          NOT: { id: runId },
        },
      },
    });

    if (existing) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.PAYROLL_SOURCE_ALREADY_CLAIMED,
        'Adjustment source is already claimed by another run.',
      );
    }
  }

  private assertManage(context: PayrollAccessContext) {
    if (!context.permissions.includes(PAYROLL_PERMISSIONS.PAYROLL_MANAGE)) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
        'Missing payroll manage permission.',
      );
    }
  }

  private assertApprove(context: PayrollAccessContext) {
    if (!context.permissions.includes(PAYROLL_PERMISSIONS.PAYROLL_APPROVE)) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
        'Missing payroll approve permission.',
      );
    }
  }

  private async recordRunEvent(
    tx: DbClient,
    companyId: string,
    runId: string,
    action: string,
    fromStatus: string,
    toStatus: string,
    versionBefore: number,
    versionAfter: number,
    operationId: string,
    actorUserId: string,
    reason?: string,
  ) {
    await this.scope.recordActionEvent(tx, {
      companyId,
      entityType: PayrollActionEntityType.PAYROLL_RUN,
      entityId: runId,
      action,
      fromStatus,
      toStatus,
      actorUserId,
      operationId,
      versionBefore,
      versionAfter,
      privateReason: reason ?? null,
    });
  }
}
