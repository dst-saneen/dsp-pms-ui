import { Injectable } from '@nestjs/common';
import {
  PayrollActionEntityType,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';

import type { PaginatedResponse } from '../dto/payroll-api.types';
import type { PayrollAccessContext } from '../payroll-access.types';
import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';
import { PayrollFeatureService } from './payroll-feature.service';

type DbClient = Prisma.TransactionClient;

export const PAYROLL_ELIGIBLE_EMPLOYMENT_STATUSES = [
  'ACTIVE',
  'PROBATION',
  'NOTICE',
] as const;

@Injectable()
export class PayrollScopeService {
  constructor(
    private readonly organizationScope: EmployeeDomainScopeService,
    private readonly featureService: PayrollFeatureService,
  ) {}

  resolveCompanyId(context: PayrollAccessContext): string {
    if (context.isGlobal || !context.activeCompanyId) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.PAYROLL_MODULE_NOT_ENABLED,
        'Select a Company to use Payroll.',
      );
    }

    return context.activeCompanyId;
  }

  async assertCompanyScope(companyId: string) {
    await this.organizationScope.assertCompanyInScope(companyId);
    if (!(await this.featureService.isEnabledForCompany(companyId))) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.PAYROLL_MODULE_NOT_ENABLED,
        'Payroll is not enabled for this Company.',
      );
    }
  }

  async assertEmployeeScope(employeeId: string) {
    return this.organizationScope.assertEmployeeInScope(employeeId);
  }

  assertExpectedVersion(current: number, expected?: number) {
    if (expected === undefined || expected === null) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
        'expectedVersion is required',
      );
    }

    if (current !== expected) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.PAYROLL_VERSION_CONFLICT,
        'Record version has changed. Refresh and retry.',
      );
    }
  }

  assertVersionedUpdate<T extends { count: number }>(
    result: T,
    entityLabel: string,
  ) {
    if (result.count === 0) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.PAYROLL_STATE_CHANGED,
        `${entityLabel} state has changed. Refresh and retry.`,
      );
    }
  }

  notFound(entityLabel = 'Payroll resource'): never {
    throw new DomainNotFoundException(
      PAYROLL_ERROR_CODES.PAYROLL_RESOURCE_NOT_FOUND,
      `${entityLabel} not found`,
    );
  }

  formatDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  parseDate(value: string, fieldName: string): Date {
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
        `${fieldName} must be YYYY-MM-DD`,
      );
    }

    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
        `${fieldName} is invalid`,
      );
    }

    return parsed;
  }

  parseMoney(value: string, fieldName: string): Prisma.Decimal {
    const trimmed = value.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
      throw new DomainConflictException(
        PAYROLL_ERROR_CODES.VALIDATION_ERROR,
        `${fieldName} must be a non-negative decimal string with up to two fractional digits`,
      );
    }

    return new Prisma.Decimal(trimmed);
  }

  decimalToString(value: Prisma.Decimal | null | undefined): string {
    if (value == null) {
      return '0.00';
    }

    return value.toFixed(2);
  }

  normalizeCode(value: string): string {
    return value.trim().replace(/\s+/g, '_').toUpperCase();
  }

  getPeriodBounds(year: number, month: number) {
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0));
    return { periodStart, periodEnd };
  }

  toPaginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponse<T> {
    return { items, total, page, limit };
  }

  async recordActionEvent(
    tx: DbClient,
    input: {
      companyId: string;
      entityType: PayrollActionEntityType;
      entityId: string;
      action: string;
      fromStatus?: string | null;
      toStatus?: string | null;
      actorUserId: string;
      privateReason?: string | null;
      privateNote?: string | null;
      operationId: string;
      versionBefore: number;
      versionAfter: number;
    },
  ) {
    await tx.payrollActionEvent.create({
      data: {
        companyId: input.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        actorUserId: input.actorUserId,
        privateReason: input.privateReason ?? null,
        privateNote: input.privateNote ?? null,
        operationId: input.operationId,
        versionBefore: input.versionBefore,
        versionAfter: input.versionAfter,
      },
    });
  }

  mapRunStatus(
    status: string | null | undefined,
    statusEnum?: PayrollRunStatus | null,
  ): PayrollRunStatus {
    if (statusEnum) {
      return statusEnum;
    }

    if (status === 'PROCESSED') {
      return 'LEGACY_IMPORTED';
    }

    return (status as PayrollRunStatus) ?? 'DRAFT';
  }
}
