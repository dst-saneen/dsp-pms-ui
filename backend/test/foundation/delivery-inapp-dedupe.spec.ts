import {
  legacyInAppNotificationDedupeKey,
  parseDeliveryMessageDedupeKey,
  resolveInAppNotificationDedupeKey,
} from '../../src/modules/delivery/delivery-inapp-dedupe.util';

describe('delivery-inapp-dedupe', () => {
  it('parses dedupe keys with colon-rich outbox segments', () => {
    const parsed = parseDeliveryMessageDedupeKey(
      'dm:recruit:interview:scheduled:sess-1:HR:hr-1:IN_APP',
    );
    expect(parsed).toEqual({
      outboxDedupeKey: 'recruit:interview:scheduled:sess-1',
      recipientKind: 'HR',
      recipientId: 'hr-1',
      channel: 'IN_APP',
    });
  });

  it('resolves legacy-compatible notification dedupe keys for in-app', () => {
    const key = resolveInAppNotificationDedupeKey({
      messageDedupeKey: 'dm:recruit:interview:scheduled:sess-1:HR:hr-1:IN_APP',
      recipientUserId: 'hr-1',
    });
    expect(key).toBe(
      legacyInAppNotificationDedupeKey(
        'recruit:interview:scheduled:sess-1',
        'hr-1',
      ),
    );
    expect(key).toBe(
      'notification:recruit:interview:scheduled:sess-1:user:hr-1',
    );
  });

  it('falls back to dm:inapp prefix for non-standard keys', () => {
    expect(
      resolveInAppNotificationDedupeKey({
        messageDedupeKey: 'legacy-key',
        recipientUserId: 'user-1',
      }),
    ).toBe('dm:inapp:legacy-key');
  });
});
