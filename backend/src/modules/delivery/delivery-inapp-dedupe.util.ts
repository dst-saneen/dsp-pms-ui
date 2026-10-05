/**
 * Parses DeliveryMessage.dedupeKey format:
 * dm:{outboxDedupeKey}:{recipientKind}:{recipientId}:{channel}
 */
export function parseDeliveryMessageDedupeKey(dedupeKey: string): {
  outboxDedupeKey: string;
  recipientKind: string;
  recipientId: string;
  channel: string;
} | null {
  if (!dedupeKey.startsWith('dm:')) {
    return null;
  }

  const parts = dedupeKey.split(':');
  if (parts.length < 5) {
    return null;
  }

  const channel = parts[parts.length - 1];
  const recipientId = parts[parts.length - 2];
  const recipientKind = parts[parts.length - 3];
  const outboxDedupeKey = parts.slice(1, parts.length - 3).join(':');

  if (!outboxDedupeKey || !recipientKind || !recipientId || !channel) {
    return null;
  }

  return { outboxDedupeKey, recipientKind, recipientId, channel };
}

/**
 * Legacy UserNotification dedupe key used by OutboxProcessorService and
 * RecruitmentDeliveryProcessor during compatibility cutover.
 */
export function legacyInAppNotificationDedupeKey(
  outboxDedupeKey: string,
  userId: string,
): string {
  return `notification:${outboxDedupeKey}:user:${userId}`;
}

/**
 * Resolves the UserNotification dedupe key for an in-app DeliveryMessage.
 * Uses the legacy key when possible so cutover cannot duplicate notifications.
 */
export function resolveInAppNotificationDedupeKey(input: {
  messageDedupeKey: string;
  recipientUserId: string;
}): string {
  const parsed = parseDeliveryMessageDedupeKey(input.messageDedupeKey);
  if (parsed?.channel === 'IN_APP') {
    return legacyInAppNotificationDedupeKey(
      parsed.outboxDedupeKey,
      input.recipientUserId,
    );
  }

  return `dm:inapp:${input.messageDedupeKey}`;
}
