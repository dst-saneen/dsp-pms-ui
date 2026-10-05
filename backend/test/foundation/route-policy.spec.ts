import { resolveRoutePermissions } from '../../src/modules/auth/route-policy';

describe('deny-by-default route policy', () => {
  it.each([
    ['GET', '/companies', 'organization.companies.read'],
    ['POST', '/companies', 'organization.companies.manage'],
    ['GET', '/employees/123', 'hr.employees.read'],
    ['PATCH', '/employees/123', 'hr.employees.manage'],
    ['DELETE', '/asset/123', 'assets.assets.manage'],
    ['GET', '/dashboard/manager', 'dashboard.read'],
    ['GET', '/attendance', 'hr.attendance.read'],
    ['PATCH', '/attendance/1/correct', 'hr.attendance.manage'],
    ['GET', '/leave-types', 'hr.leave.read'],
    ['POST', '/leave-requests/1/approve', 'hr.leave.manage'],
    ['GET', '/me/workspace', 'hr.self.read'],
    ['POST', '/me/attendance/check-in', 'hr.self.manage'],
    ['GET', '/employee-onboarding', 'hr.onboarding.read'],
    ['POST', '/onboarding-template', 'hr.onboarding.manage'],
    ['POST', '/designations/abc/departments', 'hr.onboarding.manage'],
    ['GET', '/designations/abc/departments', 'hr.onboarding.read'],
    ['GET', '/designations', 'organization.structure.read'],
    ['POST', '/designations', 'organization.structure.manage'],
    ['GET', '/shifts', 'hr.schedule.read'],
    ['POST', '/shifts', 'hr.schedule.manage'],
    ['POST', '/employee-shifts', 'hr.schedule.manage'],
    ['GET', '/employee-documents', 'hr.documents.read'],
    ['PATCH', '/employee-documents/1/verify', 'hr.documents.manage'],
    ['GET', '/employee-assets', 'assets.assignments.read'],
    ['PATCH', '/employee-assets/1/return', 'assets.assignments.manage'],
    ['GET', '/shift-rosters', 'hr.schedule.read'],
    ['POST', '/shift-rosters', 'hr.schedule.manage'],
    ['POST', '/shift-rosters/1/publish', 'hr.schedule.publish'],
    ['POST', '/shift-rosters/1/lock', 'hr.schedule.publish'],
    ['GET', '/holidays', 'hr.holidays.read'],
    ['POST', '/holidays', 'hr.holidays.manage'],
    ['GET', '/attendance/regularizations', 'hr.attendance.read'],
    ['POST', '/attendance/regularizations', 'hr.attendance.regularize'],
    [
      'POST',
      '/attendance/regularizations/1/approve',
      'hr.attendance.regularize',
    ],
    ['GET', '/attendance-periods', 'hr.attendance.read'],
    ['POST', '/attendance-periods/1/lock', 'hr.attendance.lock'],
    ['GET', '/overtime-policies', 'hr.overtime.read'],
    ['POST', '/overtime-policies', 'hr.overtime.manage'],
    ['POST', '/overtime-requests/1/approve', 'hr.overtime.approve'],
    ['GET', '/comp-off-credits', 'hr.comp-off.read'],
    ['POST', '/comp-off-credits/1/revoke', 'hr.comp-off.manage'],
    ['GET', '/workforce-calendar', 'hr.calendar.read'],
    ['GET', '/hr/recruitment/openings', 'hr.recruitment.read'],
    ['POST', '/hr/recruitment/openings', 'hr.recruitment.manage'],
    ['POST', '/hr/recruitment/openings/abc/publish', 'hr.recruitment.manage'],
    [
      'POST',
      '/hr/recruitment/applications/app1/offers/offer1/send',
      'hr.recruitment.offer',
    ],
    [
      'POST',
      '/hr/recruitment/applications/app1/offers/offer1/retry-delivery',
      'hr.recruitment.offer',
    ],
    [
      'POST',
      '/hr/recruitment/applications/app1/conversion/convert',
      'hr.recruitment.convert',
    ],
    [
      'POST',
      '/job-offers/abc/signature-submissions/sub1/verify',
      'recruitment.offer.verify',
    ],
    [
      'POST',
      '/job-offers/abc/request-signature-resubmission',
      'recruitment.offer.verify',
    ],
    ['GET', '/job-offers/abc/signature-submissions', 'hr.recruitment.offer'],
    ['GET', '/admin/operations/files/stats', 'files.operations.read'],
    ['POST', '/admin/operations/files/reconcile', 'files.operations.manage'],
    [
      'POST',
      '/admin/operations/files/clear-scan-failures',
      'files.operations.manage',
    ],
    ['GET', '/settings/security/document-retention', 'files.retention.manage'],
    ['GET', '/me/recruitment/interviews', 'hr.self.read'],
    ['POST', '/me/recruitment/interviews/abc/evaluation', 'hr.self.manage'],
    ['GET', '/hr/employees/abc/career', 'hr.recruitment.read'],
    ['GET', '/me/career', 'hr.self.read'],
    ['POST', '/hr/employees/abc/confirm-active', 'hr.recruitment.manage'],
    ['GET', '/delivery/messages', 'hr.recruitment.delivery.read'],
    ['POST', '/delivery/messages/abc/retry', 'hr.recruitment.delivery.retry'],
    ['GET', '/projects', 'projects.projects.read'],
    ['POST', '/projects', 'projects.projects.manage'],
    ['GET', '/project-tasks', 'projects.projects.read'],
    ['POST', '/task-participants', 'projects.projects.manage'],
    ['GET', '/me/project-tasks', 'projects.tasks.work'],
    ['POST', '/me/project-tasks/abc/start', 'projects.tasks.work'],
    ['GET', '/me/timesheets', 'projects.timesheets.submit'],
    ['POST', '/me/timesheets', 'projects.timesheets.submit'],
    ['GET', '/team/timesheets', 'projects.timesheets.approve'],
    ['POST', '/team/timesheets/abc/approve', 'projects.timesheets.approve'],
    ['POST', '/team/timesheets/abc/return', 'projects.timesheets.approve'],
    ['GET', '/work-log-header/1', 'projects.timesheets.submit'],
    ['POST', '/work-log-header/1/submit', 'projects.timesheets.submit'],
  ])('maps %s %s to %s', (method: string, path: string, permission: string) => {
    expect(resolveRoutePermissions(path, method)).toEqual([permission]);
  });

  it('requires platform administration for an unclassified route', () => {
    expect(resolveRoutePermissions('/new-domain/resource', 'GET')).toEqual([
      'platform.admin',
    ]);
  });

  it('keeps Project Lite self-service ahead of generic /me', () => {
    expect(resolveRoutePermissions('/me/project-tasks', 'GET')).toEqual([
      'projects.tasks.work',
    ]);
    expect(resolveRoutePermissions('/me/timesheets', 'GET')).toEqual([
      'projects.timesheets.submit',
    ]);
    expect(resolveRoutePermissions('/me/workspace', 'GET')).toEqual([
      'hr.self.read',
    ]);
  });

  it('does not map employee-assets to generic assets.assets permissions', () => {
    expect(resolveRoutePermissions('/employee-assets', 'GET')).toEqual([
      'assets.assignments.read',
    ]);
    expect(resolveRoutePermissions('/asset-categories', 'GET')).toEqual([
      'assets.assets.read',
    ]);
  });

  it('leaves authenticated self-service auth routes without domain permission', () => {
    expect(resolveRoutePermissions('/auth/me', 'GET')).toEqual([]);
    expect(resolveRoutePermissions('/auth/logout', 'POST')).toEqual([]);
    expect(resolveRoutePermissions('/auth/logout-all', 'POST')).toEqual([]);
    expect(resolveRoutePermissions('/auth/sessions', 'GET')).toEqual([]);
    expect(resolveRoutePermissions('/auth/change-password', 'POST')).toEqual(
      [],
    );
  });
});
