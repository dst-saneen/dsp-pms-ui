import { DeliveryChannel } from '@prisma/client';

import {
  DELIVERY_EVENT_REGISTRY,
  getDeliveryEventDefinition,
  legacyOutboxShouldSendEmail,
} from '../../src/modules/delivery/resolution/delivery-event.registry';

const WORKFORCE_NOTIFICATION_EVENTS = [
  'SHIFT_ROSTER_PUBLISHED',
  'SHIFT_ROSTER_LOCKED',
  'SHIFT_ROSTER_ARCHIVED',
  'LEAVE_REQUEST_SUBMITTED',
  'LEAVE_REQUEST_SUBMITTED_REQUESTER',
  'LEAVE_REQUEST_APPROVED',
  'LEAVE_REQUEST_REJECTED',
  'ATTENDANCE_REGULARIZATION_SUBMITTED',
  'ATTENDANCE_REGULARIZATION_APPROVED',
  'OVERTIME_REQUEST_SUBMITTED',
  'OVERTIME_REQUEST_APPROVED',
  'OVERTIME_REQUEST_REJECTED',
  'COMP_OFF_CREDIT_CREATED',
  'COMP_OFF_CREDIT_EXPIRED',
  'ATTENDANCE_PERIOD_REOPENED',
  'OPTIONAL_HOLIDAY_SELECTION_OPENED',
  'OPTIONAL_HOLIDAY_SELECTION_UPDATED',
  'OPTIONAL_HOLIDAY_TOMORROW',
  'ASSET_ASSIGNED',
  'ASSET_LICENSE_ALLOCATED',
  'ASSET_ACKNOWLEDGEMENT_PENDING',
  'ASSET_CUSTODY_REQUEST_SUBMITTED',
  'ASSET_CUSTODY_REQUEST_RESOLVED',
  'ASSET_TRANSFER_REQUESTED',
  'ASSET_TRANSFER_ACCEPTED',
  'ASSET_TRANSFER_REJECTED',
  'ASSET_EXPIRY_ATTENTION',
  'ASSET_LICENSE_CAPACITY_LOW',
  'ASSET_LICENSE_CAPACITY_FULL',
  'ASSET_CLEARANCE_WAIVER_REQUESTED',
  'ASSET_CLEARANCE_WAIVER_APPROVED',
  'ASSET_CLEARANCE_WAIVER_REJECTED',
  'HR_REQUEST_CREATED',
  'HR_REQUEST_APPROVAL_REQUIRED',
  'HR_REQUEST_COMPLETED',
  'HR_REQUEST_CANCELLED',
  'HR_REQUEST_APPROVED',
  'HR_REQUEST_REJECTED',
  'EMPLOYEE_SEPARATION_CREATED',
  'EMPLOYEE_SEPARATION_APPROVED',
  'EMPLOYEE_SEPARATION_APPROVAL_ADVANCED',
  'EMPLOYEE_SEPARATION_REJECTED',
  'EMPLOYEE_SEPARATION_CANCELLED',
  'EMPLOYEE_SEPARATION_COMPLETED',
  'EMPLOYEE_CLEARANCE_ITEM_CLEARED',
  'EMPLOYEE_CLEARANCE_ITEM_REOPENED',
] as const;

const channelProperties = [
  'candidateChannels',
  'panelChannels',
  'hrChannels',
  'assigneeChannels',
  'employeeChannels',
  'departmentChannels',
] as const;

describe('Delivery V2 workforce event allowlist', () => {
  it.each(WORKFORCE_NOTIFICATION_EVENTS)(
    'registers %s as an email plus in-app workforce notification',
    (eventType) => {
      const definition = getDeliveryEventDefinition(eventType);

      expect(definition).toEqual(
        expect.objectContaining({
          handlerKind: 'WORKFORCE_NOTIFICATION',
          employeeChannels: [DeliveryChannel.EMAIL, DeliveryChannel.IN_APP],
        }),
      );
      expect(legacyOutboxShouldSendEmail(eventType)).toBe(true);
    },
  );

  it('adds email to every existing typed in-app notification channel', () => {
    for (const definition of Object.values(DELIVERY_EVENT_REGISTRY)) {
      for (const property of channelProperties) {
        const channels = definition[property];
        if (!channels?.includes(DeliveryChannel.IN_APP)) continue;

        expect(channels).toContain(DeliveryChannel.EMAIL);
      }
    }
  });

  it.each([
    'unknown.workforce.event',
    'BUSINESS_CALENDAR_VERSION_REBUILT',
    'BUSINESS_CALENDAR_EVENT_RECONCILED',
    'SHIFT_ROSTER_GENERATED',
    'SHIFT_ROSTER_ENTRY_OVERRIDDEN',
    'payroll.payslip.generate',
  ])('does not email unknown or internal event %s', (eventType) => {
    expect(getDeliveryEventDefinition(eventType)).toBeUndefined();
    expect(legacyOutboxShouldSendEmail(eventType)).toBe(false);
  });

  it('keeps recruitment on its dedicated legacy mail path', () => {
    expect(
      legacyOutboxShouldSendEmail('recruitment.application.received'),
    ).toBe(false);
  });
});
