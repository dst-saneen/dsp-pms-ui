import { Injectable } from '@nestjs/common';
import {
  DeliveryChannel,
  DeliveryRecipientKind,
  OutboxEvent,
} from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import type { DeliveryEventDefinition } from './delivery-event.registry';
import { normalizeDeliveryEmail } from './delivery-email-normalize.util';
import type { RecipientResolutionResult } from './delivery-recipient.types';

@Injectable()
export class DeliveryPayrollRecipientHandler {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const employeeId =
      typeof payload.employeeId === 'string' ? payload.employeeId : null;
    const companyId =
      typeof payload.companyId === 'string' ? payload.companyId : null;
    if (!employeeId || !companyId || companyId !== event.companyId) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'RECIPIENT_SCOPE_MISMATCH',
            redactedDetail: 'Payslip event tenant snapshot is invalid',
          },
        ],
      };
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        companyId,
        isActive: true,
        ...(event.branchId ? { branchId: event.branchId } : {}),
        user: { is: { status: 'ACTIVE' } },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        user: {
          select: {
            id: true,
            email: true,
            normalizedEmail: true,
            displayName: true,
          },
        },
      },
    });
    if (!employee?.user) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'EMPLOYEE_USER_NOT_ACTIVE',
            redactedDetail: 'No active Employee User in the exact tenant scope',
          },
        ],
      };
    }

    const toAddress =
      normalizeDeliveryEmail(employee.user.normalizedEmail) ??
      normalizeDeliveryEmail(employee.user.email);
    const configuredChannels = definition.employeeChannels ?? [
      DeliveryChannel.IN_APP,
    ];
    const channels = configuredChannels.filter(
      (channel) => channel !== DeliveryChannel.EMAIL || Boolean(toAddress),
    );

    return {
      recipients: [
        {
          kind: DeliveryRecipientKind.EMPLOYEE,
          recipientId: employee.id,
          channels,
          toAddress: toAddress ?? undefined,
          displayName:
            employee.user.displayName ??
            [employee.firstName, employee.lastName].filter(Boolean).join(' '),
          subject: definition.subject,
          recipientUserId: employee.user.id,
          recipientEmployeeId: employee.id,
        },
      ],
      exceptions:
        configuredChannels.includes(DeliveryChannel.EMAIL) && !toAddress
          ? [
              {
                reasonCode: 'NO_SAFE_EMAIL',
                redactedDetail:
                  'Payslip recipient has no safe deliverable email address',
              },
            ]
          : [],
    };
  }
}
