import { Injectable } from '@nestjs/common';
import { FinanceTransaction, FinanceTransactionStatus } from '@prisma/client';

import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import type { FinanceTransactionAction } from '../dto/finance-api.types';
import { FINANCE_PERMISSIONS } from '../policies/finance-permissions';

export type TaxonomyAllowedAction = 'EDIT' | 'ARCHIVE' | 'REACTIVATE';

@Injectable()
export class FinanceCapabilityService {
  getTransactionAllowedActions(
    transaction: Pick<
      FinanceTransaction,
      | 'id'
      | 'status'
      | 'version'
      | 'createdByUserId'
      | 'submittedByUserId'
      | 'sourceType'
      | 'reversalOfTransactionId'
      | 'reversedByTransactionId'
    >,
    context: OfficeFinanceAccessContext,
  ): FinanceTransactionAction[] {
    const actions: FinanceTransactionAction[] = [];
    const canManage = this.hasPermission(
      context,
      FINANCE_PERMISSIONS.TRANSACTIONS_MANAGE,
    );
    const canApprove = this.hasPermission(
      context,
      FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE,
    );
    const canReverse = this.hasPermission(
      context,
      FINANCE_PERMISSIONS.TRANSACTIONS_REVERSE,
    );

    if (transaction.sourceType === 'PAYROLL_RUN') {
      return [];
    }

    switch (transaction.status) {
      case FinanceTransactionStatus.DRAFT:
        if (canManage) {
          actions.push('EDIT', 'SUBMIT', 'CANCEL', 'ATTACH_DOCUMENT');
        }
        break;
      case FinanceTransactionStatus.SUBMITTED:
        if (canManage) {
          actions.push('CANCEL', 'ATTACH_DOCUMENT');
        }
        if (
          canApprove &&
          transaction.createdByUserId !== context.userId &&
          transaction.submittedByUserId !== context.userId
        ) {
          actions.push('APPROVE', 'RETURN');
        }
        break;
      case FinanceTransactionStatus.APPROVED:
        if (
          canReverse &&
          !transaction.reversedByTransactionId &&
          transaction.sourceType === 'MANUAL'
        ) {
          actions.push('REVERSE');
        }
        if (canManage || canApprove || canReverse) {
          actions.push('ATTACH_DOCUMENT');
        }
        break;
      default:
        break;
    }

    return [...new Set(actions)];
  }

  getTaxonomyAllowedActions(
    record: {
      archivedAt?: Date | null;
      isActive?: boolean;
      branchId?: string | null;
    },
    context: OfficeFinanceAccessContext,
  ): TaxonomyAllowedAction[] {
    if (!this.hasPermission(context, FINANCE_PERMISSIONS.SETTINGS_MANAGE)) {
      return [];
    }

    // Categories and Business Parties are Company-wide configuration. Payment
    // accounts are the one branch-owned taxonomy; a Branch actor may only
    // manage an account explicitly owned by the active Branch.
    if (context.scopeLevel === 'BRANCH' && !context.isGlobal) {
      if (!Object.prototype.hasOwnProperty.call(record, 'branchId')) {
        return [];
      }
      if (
        !context.activeBranchId ||
        record.branchId !== context.activeBranchId
      ) {
        return [];
      }
    }

    if (record.archivedAt || record.isActive === false) {
      return ['REACTIVATE'];
    }

    return ['EDIT', 'ARCHIVE'];
  }

  private hasPermission(
    context: OfficeFinanceAccessContext,
    permission: string,
  ): boolean {
    return context.permissions.includes(permission);
  }
}
