import { Injectable } from '@nestjs/common';
import { PayrollRun, SalaryComponent } from '@prisma/client';

import type {
  PayrollRunAction,
  PayrollRunStatus,
  TaxonomyAllowedAction,
} from '../dto/payroll-api.types';
import type { PayrollAccessContext } from '../payroll-access.types';
import { PAYROLL_PERMISSIONS } from '../policies/payroll-permissions';
import { PayrollScopeService } from './payroll-scope.service';

@Injectable()
export class PayrollCapabilityService {
  constructor(private readonly scope: PayrollScopeService) {}

  getRunAllowedActions(
    run: Pick<
      PayrollRun,
      | 'id'
      | 'status'
      | 'statusEnum'
      | 'version'
      | 'createdByUserId'
      | 'calculatedByUserId'
      | 'approvedByUserId'
    >,
    context: PayrollAccessContext,
  ): PayrollRunAction[] {
    const status = this.scope.mapRunStatus(run.status, run.statusEnum);
    const actions: PayrollRunAction[] = [];
    const canManage = this.hasPermission(
      context,
      PAYROLL_PERMISSIONS.PAYROLL_MANAGE,
    );
    const canApprove = this.hasPermission(
      context,
      PAYROLL_PERMISSIONS.PAYROLL_APPROVE,
    );
    const canRead = this.hasPermission(
      context,
      PAYROLL_PERMISSIONS.PAYROLL_READ,
    );

    if (status === 'LEGACY_IMPORTED' || status === 'CANCELLED') {
      if (canRead) {
        actions.push('DOWNLOAD_REGISTER');
      }
      return [...new Set(actions)];
    }

    switch (status) {
      case 'DRAFT':
        if (canManage) {
          actions.push('EDIT_ADJUSTMENTS', 'CALCULATE', 'CANCEL');
        }
        break;
      case 'CALCULATED':
        if (canManage) {
          actions.push('RETURN_TO_DRAFT', 'CANCEL');
        }
        if (
          canApprove &&
          run.createdByUserId !== context.userId &&
          run.calculatedByUserId !== context.userId
        ) {
          actions.push('APPROVE');
        }
        break;
      case 'APPROVED':
        if (canApprove) {
          actions.push('MARK_PAID');
        }
        break;
      case 'PAID':
        break;
      default:
        break;
    }

    if (canRead || canManage || canApprove) {
      actions.push('DOWNLOAD_REGISTER');
    }

    return [...new Set(actions)];
  }

  getTaxonomyAllowedActions(
    record: { archivedAt?: Date | null; isActive?: boolean },
    context: PayrollAccessContext,
  ): TaxonomyAllowedAction[] {
    if (!this.hasPermission(context, PAYROLL_PERMISSIONS.PAYROLL_MANAGE)) {
      return [];
    }

    if (record.archivedAt || record.isActive === false) {
      return ['REACTIVATE'];
    }

    return ['EDIT', 'ARCHIVE'];
  }

  getSalaryComponentAllowedActions(
    component: Pick<SalaryComponent, 'archivedAt' | 'isActive'>,
    context: PayrollAccessContext,
  ): TaxonomyAllowedAction[] {
    return this.getTaxonomyAllowedActions(component, context);
  }

  canApproveRun(
    run: Pick<PayrollRun, 'createdByUserId' | 'calculatedByUserId'>,
    context: PayrollAccessContext,
  ): boolean {
    return (
      this.hasPermission(context, PAYROLL_PERMISSIONS.PAYROLL_APPROVE) &&
      run.createdByUserId !== context.userId &&
      run.calculatedByUserId !== context.userId
    );
  }

  isTerminalStatus(status: PayrollRunStatus): boolean {
    return (
      status === 'PAID' ||
      status === 'CANCELLED' ||
      status === 'LEGACY_IMPORTED'
    );
  }

  private hasPermission(
    context: PayrollAccessContext,
    permission: string,
  ): boolean {
    return context.permissions.includes(permission);
  }
}
