import { OutboxEventStatus } from '@prisma/client';

import { DeliveryEmailContentService } from '../../src/modules/delivery/delivery-email-content.service';
import { notificationCopy } from '../../src/modules/notification/notification-event.catalog';
import { resolveNotificationHref } from '../../src/modules/notification/notification-href';

function makeEvent(
  eventType: string,
  aggregateType: string,
  aggregateId: string,
) {
  return {
    id: 'event-1',
    companyGroupId: 'group-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    aggregateType,
    aggregateId,
    eventType,
    dedupeKey: `${eventType}:${aggregateId}`,
    status: OutboxEventStatus.PENDING,
    attempts: 0,
    availableAt: new Date('2026-09-29T00:00:00.000Z'),
    lockedAt: null,
    processedAt: null,
    lastErrorCode: null,
    payload: {},
    createdAt: new Date('2026-09-29T00:00:00.000Z'),
    updatedAt: new Date('2026-09-29T00:00:00.000Z'),
  };
}

describe('workforce notification copy and links', () => {
  it.each([
    ['HR_REQUEST_CREATED', 'HR request created'],
    ['HR_REQUEST_APPROVAL_REQUIRED', 'HR request awaiting review'],
    ['HR_REQUEST_COMPLETED', 'HR request completed'],
    ['HR_REQUEST_CANCELLED', 'HR request cancelled'],
    ['HR_REQUEST_APPROVED', 'HR request approved'],
    ['HR_REQUEST_REJECTED', 'HR request rejected'],
    ['EMPLOYEE_SEPARATION_CREATED', 'Employee separation created'],
    ['EMPLOYEE_SEPARATION_APPROVED', 'Employee separation approved'],
    [
      'EMPLOYEE_SEPARATION_APPROVAL_ADVANCED',
      'Employee separation awaiting approval',
    ],
    ['EMPLOYEE_SEPARATION_REJECTED', 'Employee separation rejected'],
    ['EMPLOYEE_SEPARATION_CANCELLED', 'Employee separation cancelled'],
    ['EMPLOYEE_SEPARATION_COMPLETED', 'Employee separation completed'],
    ['EMPLOYEE_CLEARANCE_ITEM_CLEARED', 'Clearance item completed'],
    ['EMPLOYEE_CLEARANCE_ITEM_REOPENED', 'Clearance item reopened'],
    ['projects.task.assigned', 'Project task assigned'],
    ['office-finance.transaction.submitted', 'Finance approval required'],
    ['payroll.payslip.available', 'Payslip available'],
  ])('uses specific safe copy for %s', (eventType, expectedTitle) => {
    const copy = notificationCopy(eventType);

    expect(copy.title).toBe(expectedTitle);
    expect(copy.title).not.toBe('Workforce update');
  });

  it('does not imply optional holiday approval when approval is configurable', () => {
    expect(notificationCopy('OPTIONAL_HOLIDAY_SELECTION_UPDATED').message).toBe(
      'Your optional holiday selections were saved.',
    );
  });

  it.each([
    [
      'HR_REQUEST_CREATED',
      'HrRequest',
      'request-1',
      '/my-workspace/hr-requests',
    ],
    [
      'HR_REQUEST_APPROVAL_REQUIRED',
      'HrRequest',
      'request-1',
      '/hr/hr-requests',
    ],
    [
      'HR_REQUEST_COMPLETED',
      'HrRequest',
      'request-1',
      '/my-workspace/hr-requests',
    ],
    [
      'HR_REQUEST_CANCELLED',
      'HrRequest',
      'request-1',
      '/my-workspace/hr-requests',
    ],
    [
      'HR_REQUEST_APPROVED',
      'HrRequest',
      'request-1',
      '/my-workspace/hr-requests',
    ],
    [
      'HR_REQUEST_REJECTED',
      'HrRequest',
      'request-1',
      '/my-workspace/hr-requests',
    ],
    [
      'LEAVE_REQUEST_SUBMITTED',
      'LeaveRequest',
      'leave/1',
      '/hr/leave?requestId=leave%2F1',
    ],
    [
      'LEAVE_REQUEST_APPROVED',
      'LeaveRequest',
      'leave-1',
      '/my-workspace/leave',
    ],
    [
      'EMPLOYEE_SEPARATION_CREATED',
      'EmployeeSeparation',
      'separation/1',
      '/hr/employee-separations/separation%2F1',
    ],
    [
      'EMPLOYEE_CLEARANCE_ITEM_REOPENED',
      'EmployeeSeparation',
      'separation-1',
      '/hr/employee-separations/separation-1',
    ],
    [
      'projects.task.assigned',
      'ProjectTask',
      'task-1',
      '/my-workspace/projects',
    ],
    [
      'office-finance.transaction.submitted',
      'FinanceTransaction',
      'finance/1',
      '/office-finance/transactions/finance%2F1',
    ],
  ])(
    'maps %s to its authorized action destination',
    (eventType, entityType, entityId, expected) => {
      expect(resolveNotificationHref(eventType, entityType, entityId)).toBe(
        expected,
      );
    },
  );

  it('renders a workforce email with its absolute action link without recruitment crypto', async () => {
    const service = new DeliveryEmailContentService({} as never, undefined, {
      getOrThrow: jest.fn().mockReturnValue('https://erp.example.test/'),
    } as never);

    const snapshot = await service.renderSnapshot({
      event: makeEvent('HR_REQUEST_COMPLETED', 'HrRequest', 'request-1'),
      recipient: {
        kind: 'USER',
        recipientId: 'user-1',
        recipientUserId: 'user-1',
        channels: ['EMAIL'],
        toAddress: 'employee@example.test',
        displayName: 'Employee',
      },
    });

    expect(snapshot.bodyText).toContain(
      'https://erp.example.test/my-workspace/hr-requests',
    );
    expect(snapshot.bodyHtml).toContain(
      'href="https://erp.example.test/my-workspace/hr-requests"',
    );
  });
});
