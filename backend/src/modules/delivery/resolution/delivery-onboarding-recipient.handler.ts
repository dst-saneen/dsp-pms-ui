import { Injectable } from '@nestjs/common';
import {
  DeliveryChannel,
  DeliveryRecipientKind,
  OutboxEvent,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import type { DeliveryEventDefinition } from './delivery-event.registry';
import { normalizeDeliveryEmail } from './delivery-email-normalize.util';
import { DeliveryHrRecipientService } from './delivery-hr-recipient.service';
import { buildDeliveryUserRecipients } from './delivery-user-recipient.util';
import type {
  DeliveryTenantSnapshot,
  RecipientResolutionResult,
  ResolvedRecipient,
  ResolutionExceptionInput,
} from './delivery-recipient.types';
import { tenantSnapshotFromOutbox } from './delivery-recipient.types';
import {
  tenantCheckToException,
  verifyTenantSnapshot,
} from './delivery-tenant-snapshot.util';

const USER_SELECT = {
  id: true,
  email: true,
  normalizedEmail: true,
  displayName: true,
  status: true,
} as const;

@Injectable()
export class DeliveryOnboardingRecipientHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hrRecipients: DeliveryHrRecipientService,
  ) {}

  async resolve(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    if (definition.handlerKind === 'ONBOARDING_TASK') {
      return this.resolveTask(event, definition);
    }
    return this.resolveOnboarding(event, definition);
  }

  private async resolveTask(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const hintTaskId =
      typeof payload.onboardingTaskId === 'string'
        ? payload.onboardingTaskId
        : null;

    const task =
      (await this.loadTask(event.aggregateId)) ??
      (hintTaskId ? await this.loadTask(hintTaskId) : null);

    if (!task) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'AGGREGATE_NOT_FOUND',
            redactedDetail: 'EmployeeOnboardingTask was not found',
          },
        ],
      };
    }

    const tenant: DeliveryTenantSnapshot = {
      companyGroupId: event.companyGroupId,
      companyId: task.companyId ?? task.onboarding.companyId,
      branchId: task.branchId ?? task.onboarding.branchId,
    };
    const tenantException = tenantCheckToException(
      verifyTenantSnapshot(tenantSnapshotFromOutbox(event), tenant),
    );
    if (tenantException) {
      return { recipients: [], exceptions: [tenantException] };
    }

    const recipients: ResolvedRecipient[] = [];
    const exceptions: ResolutionExceptionInput[] = [];

    if (definition.assigneeChannels?.length) {
      const assignee = this.buildUserRecipient({
        kind: DeliveryRecipientKind.USER,
        user: task.assignedToUser,
        channels: definition.assigneeChannels,
        subject: definition.subject,
      });
      if (assignee.recipient) {
        recipients.push(assignee.recipient);
      }
      exceptions.push(...assignee.exceptions);
    }

    if (
      definition.departmentPermission &&
      definition.departmentChannels?.length
    ) {
      const departmentId =
        task.executorDepartmentId ??
        task.assignedDepartmentId ??
        task.onboarding.departmentIdAtStart;
      const department = await this.resolveDepartment({
        permissionCode: definition.departmentPermission,
        tenant,
        departmentId,
        channels: definition.departmentChannels,
        subject: definition.subject,
      });
      recipients.push(...department.recipients);
      exceptions.push(...department.exceptions);
    }

    return { recipients, exceptions };
  }

  private async resolveOnboarding(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const hintOnboardingId =
      typeof payload.onboardingId === 'string' ? payload.onboardingId : null;

    const onboarding =
      (await this.loadOnboarding(event.aggregateId)) ??
      (hintOnboardingId ? await this.loadOnboarding(hintOnboardingId) : null);

    if (!onboarding) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'AGGREGATE_NOT_FOUND',
            redactedDetail: 'EmployeeOnboarding was not found',
          },
        ],
      };
    }

    const tenant: DeliveryTenantSnapshot = {
      companyGroupId: event.companyGroupId,
      companyId: onboarding.companyId,
      branchId: onboarding.branchId,
    };
    const tenantException = tenantCheckToException(
      verifyTenantSnapshot(tenantSnapshotFromOutbox(event), tenant),
    );
    if (tenantException) {
      return { recipients: [], exceptions: [tenantException] };
    }

    const recipients: ResolvedRecipient[] = [];
    const exceptions: ResolutionExceptionInput[] = [];

    if (definition.employeeChannels?.length) {
      const employeeUser = onboarding.employee.user;
      const built = this.buildUserRecipient({
        kind: DeliveryRecipientKind.EMPLOYEE,
        user: employeeUser,
        channels: definition.employeeChannels,
        subject: definition.subject,
        recipientEmployeeId: onboarding.employee.id,
      });
      if (built.recipient) {
        recipients.push(built.recipient);
      }
      exceptions.push(...built.exceptions);
    }

    if (definition.hrPermission && definition.hrChannels?.length) {
      const hrUsers = await this.hrRecipients.resolveUsers({
        permissionCode: definition.hrPermission,
        tenant,
        allowGlobal: definition.allowGlobal === true,
      });
      if (hrUsers.length === 0) {
        exceptions.push({
          reasonCode: 'NO_HR_RECIPIENTS',
          redactedDetail: 'No HR users matched the exact RoleAssignment scope',
        });
      } else {
        const built = buildDeliveryUserRecipients({
          users: hrUsers,
          kind: DeliveryRecipientKind.HR,
          channels: definition.hrChannels,
          subject: definition.subject,
        });
        recipients.push(...built.recipients);
        exceptions.push(...built.exceptions);
      }
    }

    if (
      definition.departmentPermission &&
      definition.departmentChannels?.length
    ) {
      const department = await this.resolveDepartment({
        permissionCode: definition.departmentPermission,
        tenant,
        departmentId: onboarding.departmentIdAtStart,
        channels: definition.departmentChannels,
        subject: definition.subject,
      });
      recipients.push(...department.recipients);
      exceptions.push(...department.exceptions);
    }

    return { recipients, exceptions };
  }

  private async resolveDepartment(input: {
    permissionCode: string;
    tenant: DeliveryTenantSnapshot;
    departmentId: string | null;
    channels: DeliveryChannel[];
    subject: string;
  }): Promise<RecipientResolutionResult> {
    if (
      !input.departmentId ||
      !input.tenant.companyId ||
      !input.tenant.branchId
    ) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'DEPARTMENT_SCOPE_INCOMPLETE',
            redactedDetail:
              'Department recipients require exact Company, Branch and Department',
          },
        ],
      };
    }

    const users = await this.hrRecipients.resolveUsers({
      permissionCode: input.permissionCode,
      tenant: input.tenant,
      allowGlobal: false,
      departmentId: input.departmentId,
    });

    if (users.length === 0) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'NO_DEPARTMENT_RECIPIENTS',
            redactedDetail:
              'No active users matched exact Company/Branch/Department permission',
          },
        ],
      };
    }

    return buildDeliveryUserRecipients({
      users,
      kind: DeliveryRecipientKind.USER,
      channels: input.channels,
      subject: input.subject,
    });
  }

  private buildUserRecipient(input: {
    kind: DeliveryRecipientKind;
    user: {
      id: string;
      email: string | null;
      normalizedEmail: string | null;
      displayName: string | null;
      status: UserStatus;
    } | null;
    channels: DeliveryChannel[];
    subject: string;
    recipientEmployeeId?: string;
  }): {
    recipient: ResolvedRecipient | null;
    exceptions: ResolutionExceptionInput[];
  } {
    if (!input.user || input.user.status !== UserStatus.ACTIVE) {
      return {
        recipient: null,
        exceptions: [
          {
            reasonCode: 'ASSIGNEE_MISSING',
            redactedDetail: 'Authoritative assignee is missing or inactive',
          },
        ],
      };
    }

    const email =
      normalizeDeliveryEmail(input.user.normalizedEmail) ??
      normalizeDeliveryEmail(input.user.email);
    const channels = input.channels.filter((channel) => {
      if (channel === DeliveryChannel.EMAIL) {
        return Boolean(email);
      }
      return true;
    });
    const exceptions: ResolutionExceptionInput[] = [];
    if (input.channels.includes(DeliveryChannel.EMAIL) && !email) {
      exceptions.push({
        reasonCode: 'NO_SAFE_EMAIL',
        redactedDetail: 'Assignee has no safe email address',
      });
    }
    if (channels.length === 0) {
      return { recipient: null, exceptions };
    }

    return {
      recipient: {
        kind: input.kind,
        recipientId: input.user.id,
        recipientUserId: input.user.id,
        recipientEmployeeId: input.recipientEmployeeId,
        channels,
        toAddress: email ?? undefined,
        displayName: input.user.displayName ?? undefined,
        subject: input.subject,
      },
      exceptions,
    };
  }

  private loadTask(id: string) {
    return this.prisma.employeeOnboardingTask.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        executorDepartmentId: true,
        assignedDepartmentId: true,
        assignedToUser: { select: USER_SELECT },
        onboarding: {
          select: {
            companyId: true,
            branchId: true,
            departmentIdAtStart: true,
          },
        },
      },
    });
  }

  private loadOnboarding(id: string) {
    return this.prisma.employeeOnboarding.findUnique({
      where: { id },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        departmentIdAtStart: true,
        employee: {
          select: {
            id: true,
            user: { select: USER_SELECT },
          },
        },
      },
    });
  }
}
