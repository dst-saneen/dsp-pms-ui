export const COMPANY_MODULE_CODES = [
  "ASSETS",
  "DELIVERY",
  "FILE_STORAGE",
  "FINANCE",
  "ONBOARDING",
  "PAYROLL",
  "PROJECTS",
  "RECRUITMENT",
  "RECRUITMENT_SHORTLIST",
] as const;

export type CompanyModuleCode = (typeof COMPANY_MODULE_CODES)[number];
export type CompanyModuleState = Record<CompanyModuleCode, boolean>;

export const COMPANY_MODULE_DETAILS: ReadonlyArray<{
  code: CompanyModuleCode;
  label: string;
  description: string;
  requires?: readonly CompanyModuleCode[];
}> = [
  {
    code: "RECRUITMENT",
    label: "Recruitment",
    description: "Job openings, candidates, interviews, offers, and hiring.",
  },
  {
    code: "RECRUITMENT_SHORTLIST",
    label: "Recruitment shortlist",
    description: "Candidate shortlist workflow inside Recruitment.",
    requires: ["RECRUITMENT"],
  },
  {
    code: "ONBOARDING",
    label: "Onboarding",
    description: "Employee onboarding templates, tasks, and progress.",
  },
  {
    code: "ASSETS",
    label: "Assets & licences",
    description: "Asset inventory, custody, transfers, and software licences.",
  },
  {
    code: "PROJECTS",
    label: "Projects",
    description: "Projects, stages, tasks, worklogs, and timesheets.",
  },
  {
    code: "FINANCE",
    label: "Finance",
    description: "Company finance setup, transactions, approvals, and reports.",
  },
  {
    code: "FILE_STORAGE",
    label: "File storage",
    description: "Secure files, attachments, scanning, and reconciliation.",
  },
  {
    code: "PAYROLL",
    label: "Payroll",
    description: "Payroll setup, runs, approvals, payments, and payslips.",
    requires: ["FINANCE", "FILE_STORAGE"],
  },
  {
    code: "DELIVERY",
    label: "Delivery operations",
    description: "Transactional delivery, recovery, and recipient operations.",
  },
];

export function createCompanyModuleState(
  entitlements: ReadonlyArray<{
    module: CompanyModuleCode;
    isEnabled: boolean;
  }>,
): CompanyModuleState {
  const state = Object.fromEntries(
    COMPANY_MODULE_CODES.map((module) => [module, false]),
  ) as CompanyModuleState;

  for (const entitlement of entitlements) {
    state[entitlement.module] = entitlement.isEnabled;
  }

  return state;
}

export function applyCompanyModuleToggle(
  values: CompanyModuleState,
  module: CompanyModuleCode,
  enabled: boolean,
): CompanyModuleState {
  const next = { ...values, [module]: enabled };

  if (enabled) {
    const requirements = COMPANY_MODULE_DETAILS.find(
      (item) => item.code === module,
    )?.requires;
    for (const requirement of requirements ?? []) {
      next[requirement] = true;
    }
    return next;
  }

  for (const item of COMPANY_MODULE_DETAILS) {
    if (item.requires?.includes(module)) {
      next[item.code] = false;
    }
  }

  return next;
}
