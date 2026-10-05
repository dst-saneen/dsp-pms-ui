export const API_CONFIG = {
  BASE_URL: "/api",
  TIMEOUT: 30000,
} as const;

export const API_ENDPOINTS = {
  dashboard: {
    payrollSummary: "/payroll/dashboard/company-summary",
    monthlySummary: "/payroll/dashboard/monthly-summary",
    manager: "/dashboard/manager",
  },

  onboarding: {
    preflight: "/employee-onboarding/preflight",
    start: "/employee-onboarding",
    overrideStart: "/employee-onboarding/override-start",
    me: "/me/onboarding",
    myTasks: "/me/onboarding-tasks",
    workspaceCapabilities: "/me/onboarding/workspace-capabilities",
    departmentQueue: "/employee-onboarding-task/department-queue",
    completionPreflight: (onboardingId: string) =>
      `/employee-onboarding/${onboardingId}/completion-preflight`,
    complete: (onboardingId: string) => `/employee-onboarding/${onboardingId}/complete`,
    cancel: (onboardingId: string) => `/employee-onboarding/${onboardingId}/cancel`,
    taskDetail: (taskId: string) => `/employee-onboarding-task/${taskId}`,
    assigneeCandidates: (taskId: string) =>
      `/employee-onboarding-task/${taskId}/assignee-candidates`,
    assetCandidates: (taskId: string) => `/employee-onboarding-task/${taskId}/asset-candidates`,
    reopenPreflight: (taskId: string) => `/employee-onboarding-task/${taskId}/reopen-preflight`,
    taskHistory: (taskId: string) => `/employee-onboarding-task/${taskId}/history`,
    assignTask: (taskId: string) => `/employee-onboarding-task/${taskId}/assign`,
    unassignTask: (taskId: string) => `/employee-onboarding-task/${taskId}/unassign`,
    startTask: (taskId: string) => `/employee-onboarding-task/${taskId}/start`,
    completeTask: (taskId: string) => `/employee-onboarding-task/${taskId}/complete`,
    skipTask: (taskId: string) => `/employee-onboarding-task/${taskId}/skip`,
    reopenTask: (taskId: string) => `/employee-onboarding-task/${taskId}/reopen`,
    fulfillAsset: (taskId: string) => `/employee-onboarding-task/${taskId}/fulfill-asset`,
    waiveTask: (taskId: string) => `/employee-onboarding-task/${taskId}/waive`,
  },

  me: {
    moduleCapabilities: "/me/module-capabilities",
    payslips: "/me/payslips",
    workspace: "/me/workspace",
    leave: "/me/leave",
    leaveTypes: "/me/leave-types",
    leaveRequests: "/me/leave-requests",
    leavePreviews: "/me/leave-previews",
    attendance: "/me/attendance",
    attendanceCheckIn: "/me/attendance/check-in",
    attendanceCheckOut: "/me/attendance/check-out",
    attendanceExceptions: "/me/attendance/exceptions",
    attendanceRegularizations: "/me/attendance/regularizations",
    overtime: "/me/overtime",
    compOff: "/me/comp-off",
    shiftRoster: "/me/shift-roster",
    assets: "/me/assets",
    assetRequests: "/me/assets/requests",
    assetDepartments: "/me/asset-departments",
    workforceCalendar: "/me/workforce-calendar",
    optionalHolidays: "/me/optional-holidays",
    optionalHolidaySelections: (year: number) => `/me/optional-holiday-selections/${year}`,
  },

  leaveTypes: {
    list: "/leave-types",
  },

  leavePolicies: {
    list: "/leave-policies",
  },

  leaveRequests: {
    list: "/leave-requests",
    pending: "/leave-requests/pending-approvals",
  },

  hrRequests: {
    types: "/hr-request-types",
    type: (id: string) => `/hr-request-types/${id}`,
    workflowCandidates: "/hr-request-types/workflow-candidates",
    uploadSessions: "/hr-requests/upload-sessions",
    list: "/hr-requests",
    detail: (id: string) => `/hr-requests/${id}`,
    pendingApprovals: "/hr-requests/pending-approvals",
    command: (id: string, action: "approve" | "reject" | "complete" | "cancel") =>
      `/hr-requests/${id}/${action}`,
    attachmentDownloadGrant: (id: string) => `/hr-requests/${id}/attachment/download-grant`,
  },

  approvalWorkflows: {
    list: "/approval-workflows",
    steps: "/approval-workflow-steps",
  },

  separations: {
    list: "/employee-separations",
    detail: (id: string) => `/employee-separations/${id}`,
    pendingApprovals: "/employee-separations/pending-approvals",
    clearanceDepartmentCandidates: "/employee-separations/clearance-department-candidates",
    command: (id: string, action: "approve" | "reject" | "cancel" | "complete") =>
      `/employee-separations/${id}/${action}`,
  },

  clearance: {
    list: "/employee-clearances",
    command: (itemId: string, action: "clear" | "reopen") =>
      `/employee-clearance-items/${itemId}/${action}`,
  },

  fileUploadSessions: {
    finalize: (sessionId: string) => `/file-upload-sessions/${sessionId}/finalize`,
    detail: (sessionId: string) => `/file-upload-sessions/${sessionId}`,
  },

  leaveBalances: {
    list: "/employee-leave-balances",
    generate: "/employee-leave-balances/generate",
  },

  attendance: {
    list: "/attendance",
    correct: "/attendance",
    exceptions: "/attendance/exceptions",
    regularizations: "/attendance/regularizations",
    finalizeBatch: "/attendance/finalize-batch",
  },

  attendancePeriods: {
    list: "/attendance-periods",
  },

  shiftRosters: {
    list: "/shift-rosters",
    generate: "/shift-rosters/generate",
  },

  overtimeRequests: {
    list: "/overtime-requests",
  },

  overtimePolicies: {
    list: "/overtime-policies",
  },

  compOffCredits: {
    list: "/comp-off-credits",
  },

  holidays: {
    list: "/holidays",
    directory: "/holidays/directory",
    source: "/holidays/source",
  },

  businessCalendars: {
    list: "/business-calendars",
    company: "/business-calendars/company",
    branch: "/business-calendars/branch",
    ensure: "/business-calendars/ensure",
    versions: (calendarId: string) => `/business-calendars/${calendarId}/versions`,
    version: (versionId: string) => `/business-calendar-versions/${versionId}`,
    workingWeek: (versionId: string) => `/business-calendar-versions/${versionId}/working-week`,
    events: (versionId: string) => `/business-calendar-versions/${versionId}/events`,
    event: (eventId: string) => `/business-calendar-events/${eventId}`,
    publish: (versionId: string) => `/business-calendar-versions/${versionId}/publish`,
    startAmendment: (versionId: string) =>
      `/business-calendar-versions/${versionId}/start-amendment`,
    previewImpact: (versionId: string) => `/business-calendar-versions/${versionId}/preview-impact`,
    runtimeDay: "/business-calendar/runtime/day",
    runtimeRange: "/business-calendar/runtime/range",
    runtimePreview: "/business-calendar/runtime/preview",
    runtimeRebuild: "/business-calendar/runtime/rebuild",
    metadataTypes: "/business-calendar-metadata/event-types",
    metadataCategories: "/business-calendar-metadata/categories",
    metadataSources: "/business-calendar-metadata/sources",
  },

  workforceCalendar: {
    list: "/workforce-calendar",
    team: "/team/workforce-calendar",
    employeeOptions: "/workforce-calendar/employee-options",
  },

  employees: {
    list: "/employees",
    create: "/employees",
  },

  employeeWorkspace: {
    get: "/employee-workspace",
  },

  projects: {
    list: "/projects",
    create: "/projects",
    detail: (id: string) => `/projects/${id}`,
    stages: (id: string) => `/projects/${id}/stages`,
    team: (id: string) => `/projects/${id}/team`,
    tasks: (id: string) => `/projects/${id}/tasks`,
    summary: (id: string) => `/projects/${id}/summary`,
    timeSummary: (id: string) => `/projects/${id}/time-summary`,
    financeSummary: (id: string) => `/projects/${id}/finance-summary`,
    memberCandidates: (id: string) => `/projects/${id}/member-candidates`,
    myTasks: "/me/project-tasks",
    myTimesheets: "/me/timesheets",
    teamTimesheets: "/team/timesheets",
  },

  payroll: {
    dashboard: "/payroll/dashboard",
    preflight: "/payroll/preflight",
    payslips: "/payroll/payslips",
    payslipOperations: "/payroll/payslips/operations",
    salaryComponents: "/payroll/salary-components",
    runs: "/payroll/runs",
    employeeSalaryRevisions: (employeeId: string) =>
      `/payroll/employees/${employeeId}/salary-revisions`,
    employeeTaxProfiles: (employeeId: string) => `/payroll/employees/${employeeId}/tax-profiles`,
    employeeDeductions: (employeeId: string) => `/payroll/employees/${employeeId}/deductions`,
  },

  officeFinance: {
    dashboard: "/office-finance/dashboard",
    settings: "/office-finance/settings",
    transactions: "/office-finance/transactions",
    categories: "/office-finance/categories",
    paymentAccounts: "/office-finance/payment-accounts",
    periods: "/office-finance/periods",
    reports: {
      incomeExpense: "/office-finance/reports/income-expense",
      byCategory: "/office-finance/reports/by-category",
      byDepartment: "/office-finance/reports/by-department",
      byProject: "/office-finance/reports/by-project",
      accountMovements: "/office-finance/reports/account-movements",
      exportCsv: "/office-finance/reports/export.csv",
    },
  },

  businessParties: {
    list: "/business-parties",
  },
} as const;
