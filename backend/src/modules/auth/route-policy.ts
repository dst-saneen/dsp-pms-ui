const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface RoutePermissionRule {
  pattern: RegExp;
  read: string;
  manage: string;
  area: string;
  /** POST …/publish → schedule.publish */
  publish?: string;
  /** POST …/approve|reject → approve permission */
  approve?: string;
  /** POST …/reverse → dedicated reverse permission when set */
  reverse?: string;
  /** POST …/lock → attendance.lock */
  lock?: string;
}

export const ROUTE_PERMISSION_RULES: RoutePermissionRule[] = [
  {
    area: 'Organization onboarding',
    pattern: /^organization-onboarding(?:\/|$)/,
    read: 'organization.company-groups.read',
    manage: 'organization.company-groups.manage',
  },
  {
    area: 'Company Groups',
    pattern: /^company-groups(?:\/|$)/,
    read: 'organization.company-groups.read',
    manage: 'organization.company-groups.manage',
  },
  {
    area: 'Companies',
    pattern: /^companies(?:\/|$)/,
    read: 'organization.companies.read',
    manage: 'organization.companies.manage',
  },
  {
    area: 'Company settings',
    pattern: /^company-settings(?:\/|$)/,
    read: 'organization.companies.read',
    manage: 'organization.companies.manage',
  },
  {
    area: 'Branches',
    pattern: /^branches(?:\/|$)/,
    read: 'organization.branches.read',
    manage: 'organization.branches.manage',
  },
  {
    // Onboarding template setup attaches departments to a designation template.
    // Must be checked before the generic designations structure rule so HR
    // managers with hr.onboarding.manage can configure templates.
    area: 'Designation onboarding departments',
    pattern: /^designations\/[^/]+\/departments(?:\/|$)/,
    read: 'hr.onboarding.read',
    manage: 'hr.onboarding.manage',
  },
  {
    // Shift master data is schedule setup (SCH-001), not org structure.
    // Must be before Organization structure so HR with hr.schedule.manage can CRUD.
    area: 'Shifts',
    pattern: /^(shifts|employee-shifts)(?:\/|$)/,
    read: 'hr.schedule.read',
    manage: 'hr.schedule.manage',
  },
  {
    area: 'Organization structure',
    pattern: /^(departments|designations)(?:\/|$)/,
    read: 'organization.structure.read',
    manage: 'organization.structure.manage',
  },
  {
    area: 'Employees',
    pattern: /^(employees|employee-workspace|employee-profile)(?:\/|$)/,
    read: 'hr.employees.read',
    manage: 'hr.employees.manage',
  },
  {
    area: 'Manager dashboard',
    pattern: /^dashboard(?:\/|$)/,
    read: 'dashboard.read',
    manage: 'dashboard.read',
  },
  {
    area: 'Shift roster / work schedule',
    pattern: /^shift-rosters(?:\/|$)/,
    read: 'hr.schedule.read',
    manage: 'hr.schedule.manage',
    publish: 'hr.schedule.publish',
  },
  {
    area: 'Attendance policies',
    pattern: /^attendance-policies(?:\/|$)/,
    read: 'hr.attendance.read',
    manage: 'hr.attendance.manage',
  },
  {
    area: 'Attendance regularizations',
    pattern: /^attendance\/regularizations(?:\/|$)/,
    read: 'hr.attendance.read',
    manage: 'hr.attendance.regularize',
    approve: 'hr.attendance.regularize',
  },
  {
    area: 'Attendance exceptions',
    pattern: /^attendance\/exceptions(?:\/|$)/,
    read: 'hr.attendance.read',
    manage: 'hr.attendance.manage',
  },
  {
    area: 'Attendance periods',
    pattern: /^attendance-periods(?:\/|$)/,
    read: 'hr.attendance.read',
    manage: 'hr.attendance.lock',
    lock: 'hr.attendance.lock',
  },
  {
    area: 'Attendance',
    pattern: /^attendance(?:\/|$)/,
    read: 'hr.attendance.read',
    manage: 'hr.attendance.manage',
  },
  {
    area: 'Overtime policies',
    pattern: /^overtime-policies(?:\/|$)/,
    read: 'hr.overtime.read',
    manage: 'hr.overtime.manage',
  },
  {
    area: 'Overtime requests',
    pattern: /^overtime-requests(?:\/|$)/,
    read: 'hr.overtime.read',
    manage: 'hr.overtime.manage',
    approve: 'hr.overtime.approve',
  },
  {
    area: 'Comp-off credits',
    pattern: /^comp-off-credits(?:\/|$)/,
    read: 'hr.comp-off.read',
    manage: 'hr.comp-off.manage',
  },
  {
    area: 'Workforce calendar',
    pattern: /^workforce-calendar(?:\/|$)/,
    read: 'hr.calendar.read',
    manage: 'hr.calendar.read',
  },
  {
    area: 'Team workforce calendar',
    pattern: /^team\/workforce-calendar(?:\/|$)/,
    read: 'hr.team.read',
    manage: 'hr.team.read',
  },
  {
    area: 'Holidays',
    pattern: /^holidays(?:\/|$)/,
    read: 'hr.holidays.read',
    manage: 'hr.holidays.manage',
  },
  {
    area: 'Business calendars',
    pattern:
      /^(business-calendars|business-calendar-versions|business-calendar-events|business-calendar-metadata|business-calendar-imports|business-calendar)(?:\/|$)/,
    read: 'calendar.business.read',
    manage: 'calendar.business.manage',
    publish: 'calendar.business.publish',
  },
  {
    area: 'Leave',
    pattern:
      /^(leave-types|leave-policies|leave-requests|employee-leave-balances|employee-leave)(?:\/|$)/,
    read: 'hr.leave.read',
    manage: 'hr.leave.manage',
  },
  // Project self-service and team routes must precede the generic /me rule.
  {
    area: 'Project assigned tasks (self)',
    pattern: /^me\/project-tasks(?:\/|$)/,
    read: 'projects.tasks.work',
    manage: 'projects.tasks.work',
  },
  {
    area: 'Project timesheets (self)',
    pattern: /^me\/timesheets(?:\/|$)/,
    read: 'projects.timesheets.submit',
    manage: 'projects.timesheets.submit',
  },
  {
    area: 'Project timesheets (reporting manager)',
    pattern: /^team\/timesheets(?:\/|$)/,
    read: 'projects.timesheets.approve',
    manage: 'projects.timesheets.approve',
    approve: 'projects.timesheets.approve',
  },
  {
    area: 'Projects (canonical)',
    pattern: /^projects(?:\/|$)/,
    read: 'projects.projects.read',
    manage: 'projects.projects.manage',
  },
  {
    area: 'Projects (retired compatibility routes)',
    pattern:
      /^(project-stages|project-team-members|project-tasks|task-participants|task-submissions|task-reviews|task-work-session)(?:\/|$)/,
    read: 'projects.projects.read',
    manage: 'projects.projects.manage',
  },
  {
    area: 'Project work logs (retired compatibility routes)',
    pattern: /^(work-log-header|work-log-line)(?:\/|$)/,
    read: 'projects.timesheets.submit',
    manage: 'projects.timesheets.submit',
    approve: 'projects.timesheets.approve',
  },
  {
    area: 'Self-service module capabilities',
    pattern: /^me\/module-capabilities(?:\/|$)/,
    read: 'hr.self.read',
    manage: 'hr.self.read',
  },
  {
    area: 'Office Finance settings',
    pattern: /^office-finance\/settings(?:\/|$)/,
    read: 'finance.transactions.read',
    manage: 'finance.settings.manage',
  },
  {
    area: 'Office Finance reports',
    pattern: /^office-finance\/(?:reports|dashboard)(?:\/|$)/,
    read: 'finance.reports.read',
    manage: 'finance.reports.read',
  },
  {
    area: 'Office Finance setup',
    pattern: /^office-finance\/(?:categories|payment-accounts|periods)(?:\/|$)/,
    read: 'finance.transactions.read',
    manage: 'finance.settings.manage',
    lock: 'finance.transactions.approve',
  },
  {
    area: 'Office Finance transactions',
    pattern: /^office-finance\/transactions(?:\/|$)/,
    read: 'finance.transactions.read',
    manage: 'finance.transactions.manage',
    approve: 'finance.transactions.approve',
    reverse: 'finance.transactions.reverse',
  },
  {
    area: 'Business Parties',
    pattern: /^business-parties(?:\/|$)/,
    read: 'finance.transactions.read',
    manage: 'finance.settings.manage',
  },
  {
    area: 'Payroll self-service payslips',
    pattern: /^me\/payslips(?:\/|$)/,
    read: 'payroll.self.read',
    manage: 'payroll.self.read',
  },
  {
    area: 'Payroll',
    pattern: /^payroll(?:\/|$)/,
    read: 'payroll.payroll.read',
    manage: 'payroll.payroll.manage',
    approve: 'payroll.payroll.approve',
  },
  {
    area: 'Self-service',
    pattern: /^me(?:\/|$)/,
    read: 'hr.self.read',
    manage: 'hr.self.manage',
  },
  {
    area: 'Onboarding',
    pattern:
      /^(employee-onboarding|employee-onboarding-task|onboarding-template|onboarding-template-version|onboarding-template-task|onboarding-workspace|onboarding-department-template|onboarding-task-group|onboarding-contributions|task-contribution|onboarding-requirements|onboarding-execution-profiles|onboarding-execution-rules|designation-onboarding-assignments|me\/onboarding)(?:\/|$)/,
    read: 'hr.onboarding.read',
    manage: 'hr.onboarding.manage',
    publish: 'hr.onboarding.publish',
  },
  {
    area: 'Employee documents',
    pattern:
      /^(employee-documents|employee-document-types|employee-document-categories)(?:\/|$)/,
    read: 'hr.documents.read',
    manage: 'hr.documents.manage',
  },
  // Must appear before the generic asset rule so /employee-assets is not
  // matched as assets.assets.*.
  {
    area: 'Asset assignments',
    pattern: /^employee-assets(?:\/|$)/,
    read: 'assets.assignments.read',
    manage: 'assets.assignments.manage',
  },
  {
    area: 'Asset licence allocations',
    pattern: /^asset-license-allocations(?:\/|$)/,
    read: 'assets.assignments.read',
    manage: 'assets.assignments.manage',
  },
  {
    area: 'Asset transfers',
    pattern: /^asset-transfers(?:\/|$)/,
    read: 'assets.assets.read',
    manage: 'assets.assets.manage',
  },
  {
    area: 'Asset custody requests',
    pattern: /^asset-custody-requests(?:\/|$)/,
    read: 'assets.assignments.read',
    manage: 'assets.assignments.manage',
  },
  {
    area: 'Asset clearance waivers',
    pattern: /^asset-clearance-waivers(?:\/|$)/,
    read: 'assets.clearance.waive',
    manage: 'assets.clearance.waive',
  },
  {
    area: 'Asset clearance items',
    pattern: /^asset-clearance-items(?:\/|$)/,
    read: 'assets.assignments.read',
    manage: 'assets.assignments.manage',
  },
  {
    area: 'Asset department grants',
    pattern: /^asset-department-grants(?:\/|$)/,
    read: 'assets.department-access.manage',
    manage: 'assets.department-access.manage',
  },
  {
    area: 'Assets',
    pattern: /^(assets|asset-types|asset-categories|asset)(?:\/|$)/,
    read: 'assets.assets.read',
    manage: 'assets.assets.manage',
  },
  {
    area: 'Delivery operations',
    pattern: /^delivery(?:\/|$)/,
    read: 'hr.recruitment.delivery.read',
    manage: 'hr.recruitment.delivery.retry',
  },
  {
    area: 'HR Recruitment',
    pattern: /^hr\/recruitment(?:\/|$)/,
    read: 'hr.recruitment.read',
    manage: 'hr.recruitment.manage',
  },
  {
    area: 'Public careers',
    pattern: /^public\/careers(?:\/|$)/,
    read: 'hr.recruitment.read',
    manage: 'hr.recruitment.manage',
  },
  {
    area: 'Public offer response',
    pattern: /^public\/offer-response(?:\/|$)/,
    read: 'hr.recruitment.read',
    manage: 'hr.recruitment.manage',
  },
  {
    area: 'Public signed offers',
    pattern: /^public\/offers(?:\/|$)/,
    read: 'hr.recruitment.read',
    manage: 'hr.recruitment.manage',
  },
  {
    area: 'Public careers uploads',
    pattern: /^careers\/openings(?:\/|$)/,
    read: 'hr.recruitment.read',
    manage: 'hr.recruitment.manage',
  },
  {
    area: 'Job offer signature verification',
    pattern:
      /^job-offers\/[^/]+\/(?:signature-submissions|request-signature-resubmission)(?:\/|$)/,
    read: 'hr.recruitment.offer',
    manage: 'recruitment.offer.verify',
  },
  {
    area: 'File upload sessions',
    pattern: /^file-upload-sessions(?:\/|$)/,
    read: 'hr.documents.read',
    manage: 'hr.documents.manage',
  },
  {
    area: 'Recruitment documents',
    pattern: /^recruitment-documents(?:\/|$)/,
    read: 'hr.recruitment.read',
    manage: 'hr.recruitment.manage',
  },
  {
    area: 'File operations',
    pattern: /^admin\/operations\/files(?:\/|$)/,
    read: 'files.operations.read',
    manage: 'files.operations.manage',
  },
  {
    area: 'Document retention',
    pattern: /^settings\/security\/document-retention(?:\/|$)/,
    read: 'files.retention.manage',
    manage: 'files.retention.manage',
  },
  {
    area: 'Recruitment self-service',
    pattern: /^me\/recruitment(?:\/|$)/,
    read: 'hr.self.read',
    manage: 'hr.self.manage',
  },
  {
    area: 'Employee career HR',
    pattern: /^hr\/employees\/[^/]+\/career(?:\/|$)/,
    read: 'hr.recruitment.read',
    manage: 'hr.recruitment.read',
  },
  {
    area: 'Employee career self-service',
    pattern: /^me\/career(?:\/|$)/,
    read: 'hr.self.read',
    manage: 'hr.self.read',
  },
  {
    area: 'Employee probation confirmation',
    pattern: /^hr\/employees\/[^/]+\/confirm-active(?:\/|$)/,
    read: 'hr.recruitment.read',
    manage: 'hr.recruitment.manage',
  },
];

function resolveActionPermission(
  rule: RoutePermissionRule,
  path: string,
  method: string,
): string | null {
  if (method !== 'POST' && method !== 'PATCH') {
    return null;
  }

  if (
    rule.area === 'HR Recruitment' &&
    /\/offers\/[^/]+\/(?:send|revoke|revise|retry-delivery)(?:\/|$)/.test(path)
  ) {
    return 'hr.recruitment.offer';
  }

  if (
    rule.area === 'HR Recruitment' &&
    /\/conversion\/convert(?:\/|$)/.test(path)
  ) {
    return 'hr.recruitment.convert';
  }

  if (
    rule.area === 'Employee probation confirmation' &&
    /confirm-active(?:\/|$)/.test(path)
  ) {
    return 'hr.recruitment.manage';
  }

  if (rule.publish && /\/(?:publish|lock|archive)(?:\/|$)/.test(path)) {
    // lock/archive of rosters use publish permission per work order.
    if (/\/lock(?:\/|$)/.test(path) && rule.lock) {
      return rule.lock;
    }
    return rule.publish;
  }

  if (rule.lock && /\/lock(?:\/|$)/.test(path)) {
    return rule.lock;
  }

  if (rule.reverse && /\/reverse(?:\/|$)/.test(path)) {
    return rule.reverse;
  }

  if (rule.approve && /\/(?:approve|reject|reopen|return)(?:\/|$)/.test(path)) {
    return rule.approve;
  }

  if (rule.approve && /\/reverse(?:\/|$)/.test(path)) {
    return rule.approve;
  }

  return null;
}

export function resolveRoutePermissions(
  path: string,
  method: string,
): string[] {
  const normalizedPath = path.replace(/^\/+/, '');
  const upperMethod = method.toUpperCase();

  if (normalizedPath.startsWith('auth/')) {
    return [];
  }

  const rule = ROUTE_PERMISSION_RULES.find((candidate) =>
    candidate.pattern.test(normalizedPath),
  );

  if (!rule) {
    return ['platform.admin'];
  }

  if (READ_METHODS.has(upperMethod)) {
    return [rule.read];
  }

  const action = resolveActionPermission(rule, normalizedPath, upperMethod);
  if (action) {
    return [action];
  }

  return [rule.manage];
}
