import { DeliveryChannel, DeliveryRecipientKind } from '@prisma/client';

import { normalizeDeliveryEmail } from './delivery-email-normalize.util';
import type { RecipientResolutionResult } from './delivery-recipient.types';

export interface DeliveryUserContact {
  id: string;
  displayName: string | null;
  email: string | null;
  normalizedEmail: string | null;
  employee: { id: string } | null;
}

export function buildDeliveryUserRecipients(input: {
  users: DeliveryUserContact[];
  kind: DeliveryRecipientKind;
  channels: DeliveryChannel[];
  subject: string;
}): RecipientResolutionResult {
  const exceptions: RecipientResolutionResult['exceptions'] = [];
  const recipients = input.users.flatMap((user) => {
    const toAddress =
      normalizeDeliveryEmail(user.normalizedEmail) ??
      normalizeDeliveryEmail(user.email);
    const channels = input.channels.filter(
      (channel) => channel !== DeliveryChannel.EMAIL || Boolean(toAddress),
    );

    if (input.channels.includes(DeliveryChannel.EMAIL) && !toAddress) {
      exceptions.push({
        reasonCode: 'NO_SAFE_EMAIL',
        redactedDetail:
          'Internal user recipient has no safe deliverable email address',
      });
    }
    if (channels.length === 0) {
      return [];
    }

    const employeeRecipient =
      input.kind === DeliveryRecipientKind.EMPLOYEE && user.employee;
    return [
      {
        kind: input.kind,
        recipientId: employeeRecipient ? user.employee!.id : user.id,
        recipientUserId: user.id,
        recipientEmployeeId: user.employee?.id,
        channels,
        toAddress: toAddress ?? undefined,
        displayName: user.displayName ?? undefined,
        subject: input.subject,
      },
    ];
  });

  return { recipients, exceptions };
}
