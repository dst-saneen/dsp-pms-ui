import { Injectable } from '@nestjs/common';
import {
  DeliveryChannel,
  DeliveryRecipientKind,
  OutboxEvent,
  UserStatus,
} from '@prisma/client';

import { FINANCE_PERMISSIONS } from '../../office-finance/policies/finance-permissions';
import { PrismaService } from '../../../prisma/prisma.service';

import type {
  DeliveryEventDefinition,
  FinanceDeliveryRecipientRule,
} from './delivery-event.registry';
import { DeliveryHrRecipientService } from './delivery-hr-recipient.service';
import { buildDeliveryUserRecipients } from './delivery-user-recipient.util';
import type {
  DeliveryTenantSnapshot,
  RecipientResolutionResult,
} from './delivery-recipient.types';

@Injectable()
export class DeliveryOfficeFinanceRecipientHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hrRecipients: DeliveryHrRecipientService,
  ) {}

  async resolve(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    const rule = definition.financeRecipientRule;
    if (!rule) {
      return this.unsupported('Finance event is missing a recipient rule');
    }

    if (event.aggregateType === 'FinanceTransaction') {
      return this.resolveTransaction(event, definition, rule);
    }
    if (event.aggregateType === 'FinancePeriod') {
      return this.resolvePeriod(event, definition, rule);
    }
    return this.unsupported('Finance event has an unsupported aggregate type');
  }

  private async resolveTransaction(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
    rule: FinanceDeliveryRecipientRule,
  ): Promise<RecipientResolutionResult> {
    const transaction = await this.prisma.financeTransaction.findUnique({
      where: { id: event.aggregateId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        createdByUserId: true,
        submittedByUserId: true,
        company: { select: { companyGroupId: true } },
      },
    });
    if (!transaction) {
      return this.notFound('Finance transaction');
    }

    const tenant: DeliveryTenantSnapshot = {
      companyGroupId: transaction.company.companyGroupId,
      companyId: transaction.companyId,
      branchId: transaction.branchId,
    };
    const mismatch = this.exactTenantMismatch(event, tenant);
    if (mismatch) {
      return mismatch;
    }

    if (rule === 'TRANSACTION_APPROVERS') {
      return this.resolvePermissionRecipients(
        tenant,
        [FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE],
        definition,
      );
    }

    if (rule === 'TRANSACTION_OWNER') {
      return this.resolveDirectUsers(
        [transaction.submittedByUserId, transaction.createdByUserId],
        tenant,
        definition,
        'NO_ACTIVE_TRANSACTION_OWNER',
      );
    }

    return this.unsupported('Finance period rule cannot target a transaction');
  }

  private async resolvePeriod(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
    rule: FinanceDeliveryRecipientRule,
  ): Promise<RecipientResolutionResult> {
    if (rule !== 'FINANCE_OPERATIONS') {
      return this.unsupported(
        'Transaction recipient rule cannot target a period',
      );
    }

    const period = await this.prisma.financePeriod.findUnique({
      where: { id: event.aggregateId },
      select: {
        id: true,
        companyId: true,
        company: { select: { companyGroupId: true } },
      },
    });
    if (!period) {
      return this.notFound('Finance period');
    }

    const tenant: DeliveryTenantSnapshot = {
      companyGroupId: period.company.companyGroupId,
      companyId: period.companyId,
      branchId: null,
    };
    const mismatch = this.exactTenantMismatch(event, tenant);
    if (mismatch) {
      return mismatch;
    }

    return this.resolvePermissionRecipients(
      tenant,
      [
        FINANCE_PERMISSIONS.TRANSACTIONS_MANAGE,
        FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE,
      ],
      definition,
    );
  }

  private async resolvePermissionRecipients(
    tenant: DeliveryTenantSnapshot,
    permissionCodes: string[],
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    const exactScopes = this.hrRecipients.buildExactScopeFilter(tenant, false);
    if (!exactScopes || !tenant.companyId) {
      return this.unsupported('Finance event has no complete tenant scope');
    }

    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        employee: {
          is: {
            isActive: true,
            companyId: tenant.companyId,
            ...(tenant.branchId ? { branchId: tenant.branchId } : {}),
          },
        },
        roleAssignments: {
          some: {
            isActive: true,
            OR: exactScopes,
            role: {
              isActive: true,
              permissions: {
                some: { permission: { code: { in: permissionCodes } } },
              },
            },
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        normalizedEmail: true,
        employee: { select: { id: true } },
      },
      take: 200,
    });

    const built = this.toEmployeeRecipients(users, definition);
    return {
      recipients: built.recipients,
      exceptions:
        built.recipients.length > 0
          ? built.exceptions
          : [
              ...built.exceptions,
              {
                reasonCode: 'NO_FINANCE_PERMISSION_RECIPIENTS',
                redactedDetail:
                  'No active Employee User matched the exact Finance RoleAssignment scope',
              },
            ],
    };
  }

  private async resolveDirectUsers(
    userIds: Array<string | null>,
    tenant: DeliveryTenantSnapshot,
    definition: DeliveryEventDefinition,
    missingReasonCode: string,
  ): Promise<RecipientResolutionResult> {
    if (!tenant.companyId) {
      return this.unsupported('Finance event has no Company scope');
    }
    const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: missingReasonCode,
            redactedDetail: 'Finance transaction has no persisted owner User',
          },
        ],
      };
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { in: ids },
        status: UserStatus.ACTIVE,
        employee: {
          is: {
            isActive: true,
            companyId: tenant.companyId,
            ...(tenant.branchId ? { branchId: tenant.branchId } : {}),
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        normalizedEmail: true,
        employee: { select: { id: true } },
      },
    });

    const built = this.toEmployeeRecipients(users, definition);
    return {
      recipients: built.recipients,
      exceptions:
        built.recipients.length > 0
          ? built.exceptions
          : [
              ...built.exceptions,
              {
                reasonCode: missingReasonCode,
                redactedDetail:
                  'No active Employee User exists in the exact Finance tenant scope',
              },
            ],
    };
  }

  private toEmployeeRecipients(
    users: Array<{
      id: string;
      displayName: string | null;
      email: string | null;
      normalizedEmail: string | null;
      employee: { id: string } | null;
    }>,
    definition: DeliveryEventDefinition,
  ): RecipientResolutionResult {
    const channels = definition.employeeChannels ?? [DeliveryChannel.IN_APP];
    return buildDeliveryUserRecipients({
      users: users.filter((user) => Boolean(user.employee)),
      kind: DeliveryRecipientKind.EMPLOYEE,
      channels,
      subject: definition.subject,
    });
  }

  private exactTenantMismatch(
    event: OutboxEvent,
    aggregate: DeliveryTenantSnapshot,
  ): RecipientResolutionResult | null {
    if (
      !event.companyId ||
      event.companyId !== aggregate.companyId ||
      event.branchId !== aggregate.branchId ||
      event.companyGroupId !== aggregate.companyGroupId
    ) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'TENANT_MISMATCH',
            redactedDetail:
              'Outbox Finance tenant snapshot does not exactly match the persisted aggregate',
          },
        ],
      };
    }
    return null;
  }

  private notFound(aggregateName: string): RecipientResolutionResult {
    return {
      recipients: [],
      exceptions: [
        {
          reasonCode: 'AGGREGATE_NOT_FOUND',
          redactedDetail: `${aggregateName} was not found`,
        },
      ],
    };
  }

  private unsupported(detail: string): RecipientResolutionResult {
    return {
      recipients: [],
      exceptions: [
        {
          reasonCode: 'UNSUPPORTED_EVENT',
          redactedDetail: detail,
        },
      ],
    };
  }
}
