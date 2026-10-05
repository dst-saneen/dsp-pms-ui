import {
  mondayOfWeek,
  parseDateOnly,
  weekEndingSunday,
} from '../../src/modules/projects/policies/work-log-week';
import { PROJECT_NOTIFICATION_EVENT } from '../../src/modules/projects/services/project-notification.service';
import { getDeliveryEventDefinition } from '../../src/modules/delivery/resolution/delivery-event.registry';

describe('Project Lite Phase 6 finance summary contract', () => {
  it('documents the disabled Office Finance stub shape', () => {
    const stub = {
      enabled: false,
      approvedIncome: null,
      approvedExpenses: null,
      netOperationalCash: null,
    };
    expect(stub.enabled).toBe(false);
    expect(stub).not.toHaveProperty('profit');
    expect(stub).not.toHaveProperty('margin');
  });
});

describe('Project Lite Phase 6 notification registry', () => {
  it('registers timesheet and project lifecycle events for Delivery', () => {
    expect(
      getDeliveryEventDefinition(PROJECT_NOTIFICATION_EVENT.TIMESHEET_SUBMITTED)
        ?.handlerKind,
    ).toBe('PROJECT');
    expect(
      getDeliveryEventDefinition(PROJECT_NOTIFICATION_EVENT.PROJECT_ACTIVATED)
        ?.handlerKind,
    ).toBe('PROJECT');
    expect(
      getDeliveryEventDefinition(PROJECT_NOTIFICATION_EVENT.TASK_ASSIGNED)
        ?.handlerKind,
    ).toBe('PROJECT');
  });
});

describe('Project Lite Phase 6 week helpers still hold', () => {
  it('keeps Monday–Sunday boundaries', () => {
    const start = mondayOfWeek(parseDateOnly('2026-08-21'));
    expect(start.toISOString().slice(0, 10)).toBe('2026-08-17');
    expect(weekEndingSunday(start).toISOString().slice(0, 10)).toBe(
      '2026-08-23',
    );
  });
});
