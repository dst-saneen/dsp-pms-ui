import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants';
import { getRequestActor, getRequestId } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth';
import { AuditService } from '../audit/audit.service';

import { CreateEmployeeLeaveBalanceDto } from './dto/create-employee-leave-balance.dto';
import { DeactivateEmployeeLeaveBalanceDto } from './dto/deactivate-employee-leave-balance.dto';
import { UpdateEmployeeLeaveBalanceDto } from './dto/update-employee-leave-balance.dto';
import { EmployeeLeaveBalanceFilterDto } from './dto/employee-leave-balance-filter.dto';
import { LeaveBalanceLedgerService } from './leave-balance-ledger.service';

const SERIALIZABLE_RETRY_LIMIT = 3;

@Injectable()
export class EmployeeLeaveBalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly leaveBalanceLedger: LeaveBalanceLedgerService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateEmployeeLeaveBalanceDto) {
    const employee = await this.employeeDomainScope.assertEmployeeInScope(
      dto.employeeId,
    );

    const leaveType = await this.prisma.leaveType.findFirst({
      where: {
        id: dto.leaveTypeId,
        companyId: employee.companyId,
        isActive: true,
        ...this.employeeDomainScope.leaveTypeWhere(),
      },
    });

    if (!leaveType) {
      throw new BadRequestException('Leave type not found');
    }

    const reason = dto.reason.trim();
    const actorUserId = getRequestActor().userId ?? null;

    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.employeeLeaveBalance.findFirst({
            where: {
              employeeId: dto.employeeId,
              leaveTypeId: dto.leaveTypeId,
              year: dto.year,
              isActive: true,
            },
          });

          if (existing) {
            throw new BadRequestException('Leave balance already exists');
          }

          const created = await this.leaveBalanceLedger.createGeneratedBalance({
            tx,
            employee: {
              id: employee.id,
              companyId: employee.companyId,
              branchId: employee.branchId,
            },
            leaveTypeId: dto.leaveTypeId,
            year: dto.year,
            annualEntitlement: dto.entitlement,
            carryForward: 0,
            createdByUserId: actorUserId,
            reason,
          });

          const row = await tx.employeeLeaveBalance.findUniqueOrThrow({
            where: { id: created.id },
            include: {
              employee: true,
              leaveType: true,
            },
          });

          await this.auditService.log(
            'EmployeeLeaveBalance',
            row.id,
            'CREATE',
            null,
            {
              employeeId: row.employeeId,
              leaveTypeId: row.leaveTypeId,
              year: row.year,
              entitlement: Number(row.entitlement),
              reason,
            },
            { tx },
          );

          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async findAll(filters: EmployeeLeaveBalanceFilterDto) {
    const employeeScope = this.employeeDomainScope.employeeWhere();
    const where: Prisma.EmployeeLeaveBalanceWhereInput = {
      isActive: true,
      employee: {
        ...employeeScope,
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
      },
    };

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.leaveTypeId) {
      where.leaveTypeId = filters.leaveTypeId;
    }

    if (filters.year) {
      where.year = filters.year;
    }

    return this.prisma.employeeLeaveBalance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            companyId: true,
            branchId: true,
            designationId: true,
            company: {
              select: { id: true, companyCode: true, companyName: true },
            },
            branch: {
              select: { id: true, branchCode: true, branchName: true },
            },
            designation: {
              select: {
                id: true,
                designationCode: true,
                designationName: true,
              },
            },
          },
        },
        leaveType: {
          select: {
            id: true,
            leaveCode: true,
            leaveName: true,
            isPaid: true,
          },
        },
      },
      orderBy: [
        { employee: { firstName: 'asc' } },
        { employee: { lastName: 'asc' } },
        { leaveType: { leaveName: 'asc' } },
      ],
    });
  }

  async findOne(id: string) {
    const balance = await this.prisma.employeeLeaveBalance.findFirst({
      where: {
        id,
        isActive: true,
        ...this.employeeDomainScope.leaveBalanceWhere(),
      },
      include: {
        employee: true,
        leaveType: true,
      },
    });

    if (!balance) {
      throw new NotFoundException('Leave balance not found');
    }

    return balance;
  }

  async getEmployeeBalances(employeeId: string, year?: number) {
    await this.employeeDomainScope.assertEmployeeInScope(employeeId);

    return this.prisma.employeeLeaveBalance.findMany({
      where: {
        employeeId,
        year: year ?? new Date().getFullYear(),
        isActive: true,
        ...this.employeeDomainScope.leaveBalanceWhere(),
      },
      include: {
        leaveType: true,
      },
      orderBy: {
        leaveType: {
          leaveName: 'asc',
        },
      },
    });
  }

  async getEmployeeBalanceSummary(employeeId: string, year?: number) {
    const balances = await this.getEmployeeBalances(employeeId, year);

    return {
      totalEntitlement: balances.reduce(
        (sum, b) => sum + Number(b.entitlement),
        0,
      ),
      totalUsed: balances.reduce((sum, b) => sum + Number(b.used), 0),
      totalPending: balances.reduce((sum, b) => sum + Number(b.pending), 0),
      totalBalance: balances.reduce((sum, b) => sum + Number(b.balance), 0),
    };
  }

  async getEmployeeLeaveBalance(
    employeeId: string,
    leaveTypeId: string,
    year?: number,
  ) {
    return this.prisma.employeeLeaveBalance.findFirst({
      where: {
        employeeId,
        leaveTypeId,
        year: year ?? new Date().getFullYear(),
        isActive: true,
      },
      include: {
        leaveType: true,
      },
    });
  }

  async update(id: string, dto: UpdateEmployeeLeaveBalanceDto) {
    const existing = await this.findOne(id);
    const reason = dto.reason.trim();
    const nextEntitlement = dto.entitlement;
    const used = Number(existing.used);
    const pending = Number(existing.pending);

    if (nextEntitlement < used + pending) {
      throw new ConflictException({
        code: WorkforceErrorCode.LEAVE_BALANCE_INSUFFICIENT,
        message:
          'Entitlement cannot be reduced below used plus pending leave days',
      });
    }

    const actorUserId = getRequestActor().userId ?? null;
    const requestId = getRequestId() ?? id;

    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          await this.lockLeaveBalance(tx, id);
          const current = await tx.employeeLeaveBalance.findFirst({
            where: {
              id,
              isActive: true,
              ...this.employeeDomainScope.leaveBalanceWhere(),
            },
            include: { employee: true, leaveType: true },
          });

          if (!current) {
            throw new NotFoundException('Leave balance not found');
          }

          const currentUsed = Number(current.used);
          const currentPending = Number(current.pending);
          const currentEntitlement = Number(current.entitlement);
          const delta = nextEntitlement - currentEntitlement;

          if (nextEntitlement < currentUsed + currentPending) {
            throw new ConflictException({
              code: WorkforceErrorCode.LEAVE_BALANCE_INSUFFICIENT,
              message:
                'Entitlement cannot be reduced below used plus pending leave days',
            });
          }

          if (delta !== 0) {
            await this.leaveBalanceLedger.adjustEntitlement({
              tx,
              leaveBalance: current,
              entitlementDelta: delta,
              balanceDelta: delta,
              effectiveDate: new Date(),
              referenceType: 'LEAVE_BALANCE_ADJUSTMENT',
              referenceId: current.id,
              idempotencyKey: `LEAVE_BALANCE_ADJUST:${current.id}:${requestId}`,
              reason,
              createdByUserId: actorUserId,
            });
          }

          const updated = await tx.employeeLeaveBalance.findUniqueOrThrow({
            where: { id },
            include: { employee: true, leaveType: true },
          });

          await this.auditService.log(
            'EmployeeLeaveBalance',
            updated.id,
            'UPDATE',
            {
              entitlement: currentEntitlement,
              used: currentUsed,
              pending: currentPending,
              balance: Number(current.balance),
            },
            {
              entitlement: Number(updated.entitlement),
              used: Number(updated.used),
              pending: Number(updated.pending),
              balance: Number(updated.balance),
              reason,
            },
            { tx },
          );

          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  async remove(id: string, dto: DeactivateEmployeeLeaveBalanceDto) {
    const existing = await this.findOne(id);
    const reason = dto.reason.trim();

    if (Number(existing.pending) > 0) {
      throw new ConflictException({
        code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
        message:
          'Cannot deactivate a leave balance while days are still pending approval',
      });
    }

    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          await this.lockLeaveBalance(tx, id);
          const current = await tx.employeeLeaveBalance.findFirst({
            where: {
              id,
              isActive: true,
              ...this.employeeDomainScope.leaveBalanceWhere(),
            },
          });

          if (!current) {
            throw new NotFoundException('Leave balance not found');
          }

          if (Number(current.pending) > 0) {
            throw new ConflictException({
              code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
              message:
                'Cannot deactivate a leave balance while days are still pending approval',
            });
          }

          const updated = await tx.employeeLeaveBalance.update({
            where: { id },
            data: { isActive: false },
            include: { employee: true, leaveType: true },
          });

          await this.auditService.log(
            'EmployeeLeaveBalance',
            updated.id,
            'DELETE',
            {
              isActive: true,
              entitlement: Number(current.entitlement),
              used: Number(current.used),
              pending: Number(current.pending),
              balance: Number(current.balance),
            },
            { isActive: false, reason },
            { tx },
          );

          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  private async lockLeaveBalance(
    tx: Prisma.TransactionClient,
    leaveBalanceId: string,
  ) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`leave-balance:${leaveBalanceId}`}, 0))`,
    );
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>) {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < SERIALIZABLE_RETRY_LIMIT) {
      attempt += 1;
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (
          !this.isSerializationFailure(error) ||
          attempt >= SERIALIZABLE_RETRY_LIMIT
        ) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  private isSerializationFailure(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const candidate = error as { code?: string; message?: string };
    if (candidate.code === 'P2034') {
      return true;
    }
    const message = candidate.message?.toLowerCase() ?? '';
    return (
      message.includes('could not serialize') ||
      message.includes('serialization') ||
      message.includes('deadlock')
    );
  }
}
