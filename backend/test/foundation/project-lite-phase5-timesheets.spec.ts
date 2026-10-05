import {
  canTransitionWorkLog,
  isEditableWorkLogStatus,
} from '../../src/modules/projects/policies/work-log-transitions';
import { computeWorkLogAllowedActions } from '../../src/modules/projects/policies/work-log-allowed-actions';
import {
  isDateWithinInclusive,
  mondayOfWeek,
  parseDateOnly,
  weekEndingSunday,
} from '../../src/modules/projects/policies/work-log-week';
import { PROJECTS_PERMISSIONS } from '../../src/modules/projects/constants/projects-permissions';

describe('Project Lite Phase 5 timesheet transitions', () => {
  it('allows the locked work-log graph', () => {
    expect(canTransitionWorkLog('DRAFT', 'SUBMITTED')).toBe(true);
    expect(canTransitionWorkLog('SUBMITTED', 'APPROVED')).toBe(true);
    expect(canTransitionWorkLog('SUBMITTED', 'RETURNED')).toBe(true);
    expect(canTransitionWorkLog('RETURNED', 'SUBMITTED')).toBe(true);
    expect(canTransitionWorkLog('DRAFT', 'CANCELLED')).toBe(true);
    expect(canTransitionWorkLog('RETURNED', 'CANCELLED')).toBe(true);
    expect(canTransitionWorkLog('APPROVED', 'RETURNED')).toBe(false);
    expect(isEditableWorkLogStatus('DRAFT')).toBe(true);
    expect(isEditableWorkLogStatus('RETURNED')).toBe(true);
    expect(isEditableWorkLogStatus('SUBMITTED')).toBe(false);
  });
});

describe('Project Lite Phase 5 week helpers', () => {
  it('normalizes periodStart to Monday–Sunday UTC', () => {
    const wednesday = parseDateOnly('2026-08-19');
    const start = mondayOfWeek(wednesday);
    const end = weekEndingSunday(start);
    expect(start.toISOString().slice(0, 10)).toBe('2026-08-17');
    expect(end.toISOString().slice(0, 10)).toBe('2026-08-23');
    expect(isDateWithinInclusive(parseDateOnly('2026-08-17'), start, end)).toBe(
      true,
    );
    expect(isDateWithinInclusive(parseDateOnly('2026-08-24'), start, end)).toBe(
      false,
    );
  });
});

describe('Project Lite Phase 5 allowedActions', () => {
  const owner = {
    userId: 'user-owner',
    employeeId: 'emp-1',
    permissions: [PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT],
  };

  const manager = {
    userId: 'user-manager',
    employeeId: 'emp-mgr',
    permissions: [PROJECTS_PERMISSIONS.TIMESHEETS_APPROVE],
  };

  it('gives owner edit/submit on draft', () => {
    expect(
      computeWorkLogAllowedActions({
        status: 'DRAFT',
        employeeId: 'emp-1',
        reportingManagerUserId: null,
        submittedByUserId: null,
        actor: owner,
      }),
    ).toEqual(expect.arrayContaining(['EDIT', 'SUBMIT', 'CANCEL']));
  });

  it('gives snapshotted manager approve/return on submitted', () => {
    expect(
      computeWorkLogAllowedActions({
        status: 'SUBMITTED',
        employeeId: 'emp-1',
        reportingManagerUserId: 'user-manager',
        submittedByUserId: 'user-owner',
        actor: manager,
      }),
    ).toEqual(expect.arrayContaining(['APPROVE', 'RETURN']));
  });

  it('blocks self-approval', () => {
    expect(
      computeWorkLogAllowedActions({
        status: 'SUBMITTED',
        employeeId: 'emp-1',
        reportingManagerUserId: 'user-owner',
        submittedByUserId: 'user-owner',
        actor: {
          ...owner,
          permissions: [
            PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT,
            PROJECTS_PERMISSIONS.TIMESHEETS_APPROVE,
          ],
        },
      }),
    ).toEqual([]);
  });
});
