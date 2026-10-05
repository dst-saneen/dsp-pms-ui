import { notificationCopy } from './notification-event.catalog';
import { resolveNotificationHref } from './notification-href';

describe('onboarding notification honesty', () => {
  it('uses clear copy for due-soon and overdue reminders', () => {
    expect(notificationCopy('ONBOARDING_TASK_DUE_SOON').title).toBe(
      'Onboarding task due soon',
    );
    expect(notificationCopy('ONBOARDING_TASK_OVERDUE').title).toBe(
      'Onboarding task overdue',
    );
    expect(notificationCopy('ONBOARDING_TASK_DUE_SOON').priority).toBe('HIGH');
  });

  it('links onboarding notifications to My Workspace Onboarding', () => {
    expect(resolveNotificationHref('ONBOARDING_TASK_DUE_SOON')).toBe(
      '/my-workspace/onboarding',
    );
    expect(resolveNotificationHref('ONBOARDING_TASK_OVERDUE')).toBe(
      '/my-workspace/onboarding',
    );
    expect(resolveNotificationHref('ONBOARDING_STARTED')).toBe(
      '/my-workspace/onboarding',
    );
  });
});
