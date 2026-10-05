export type ReferenceLayerMode = 'SEEDED' | 'CONTRACT_ONLY';

export type ReferenceLayerPlanEntry = {
  key: string;
  mode: ReferenceLayerMode;
  dependsOn: ReadonlyArray<string>;
  reason: string;
};

export const REFERENCE_LAYER_PLAN = Object.freeze([
  {
    key: 'company-module-entitlements',
    mode: 'CONTRACT_ONLY',
    dependsOn: ['companies'],
    reason:
      'CompanyModuleEntitlement defaults are provisioned by the database migration trigger, so reference seeding validates the canonical module set without duplicating database-owned defaults.',
  },
  {
    key: 'currency-catalog',
    mode: 'CONTRACT_ONLY',
    dependsOn: [],
    reason:
      'No Currency model or foreign key exists. The seed adapter consistently applies the contracted uppercase ISO codes to currency string fields instead.',
  },
  {
    key: 'normal-and-overnight-shifts',
    mode: 'SEEDED',
    dependsOn: ['companies'],
    reason: 'Existing guarded organization-foundation adapter.',
  },
  {
    key: 'monday-friday-branch-working-calendars',
    mode: 'SEEDED',
    dependsOn: ['branches'],
    reason: 'Existing guarded organization-foundation adapter.',
  },
  {
    key: 'reviewed-country-holidays',
    mode: 'CONTRACT_ONLY',
    dependsOn: ['companies', 'branches'],
    reason:
      'Holiday publication is a reviewed, versioned business-calendar workflow; direct rows would bypass validation, approval, runtime materialization, and provenance.',
  },
  {
    key: 'financial-profiles-categories-accounts-and-open-periods',
    mode: 'SEEDED',
    dependsOn: ['companies', 'qa-seed-audit-actor'],
    reason: 'Guarded deterministic Company-scoped finance master adapter.',
  },
  {
    key: 'salary-components',
    mode: 'SEEDED',
    dependsOn: ['companies', 'qa-seed-audit-actor'],
    reason: 'Guarded deterministic Payroll component catalog adapter.',
  },
  {
    key: 'effective-salaries-and-tax-profiles',
    mode: 'CONTRACT_ONLY',
    dependsOn: ['employees', 'salary-components'],
    reason:
      'Employee salaries and tax profiles are effective-dated compensation records. Stable personas are seeded, but compensation remains a separately reviewed workflow setup and is not manufactured by the identity seeder.',
  },
  {
    key: 'leave-types-and-branch-policies',
    mode: 'SEEDED',
    dependsOn: ['companies', 'branches'],
    reason: 'Guarded deterministic Company and Branch policy adapter.',
  },
  {
    key: 'attendance-and-overtime-policies',
    mode: 'CONTRACT_ONLY',
    dependsOn: ['companies', 'branches', 'qa-seed-audit-actor'],
    reason:
      'These effective-dated policies carry actor and conflict semantics. They must be created through their policy services after stable QA persona provisioning.',
  },
  {
    key: 'workforce-approval-routes',
    mode: 'SEEDED',
    dependsOn: ['companies'],
    reason:
      'Guarded deterministic Leave and Overtime workflow and ordered-step adapter.',
  },
  {
    key: 'service-owned-independent-approval-controls',
    mode: 'CONTRACT_ONLY',
    dependsOn: ['stable-personas', 'projects', 'finance', 'payroll', 'assets'],
    reason:
      'Timesheet, Finance, Payroll, and sensitive Asset-waiver approval are enforced in their domain services and do not resolve ApprovalWorkflow rows. They must be exercised through authenticated service flows with distinct actors.',
  },
  {
    key: 'published-onboarding-templates',
    mode: 'CONTRACT_ONLY',
    dependsOn: ['companies', 'departments', 'asset-types'],
    reason:
      'Publishing must run template validation, row locking, audit, outbox, and current-version retirement in the application service; direct Prisma publication is intentionally forbidden.',
  },
  {
    key: 'secure-file-purposes-and-recruitment-document-mappings',
    mode: 'CONTRACT_ONLY',
    dependsOn: ['companies', 'file-provider-sandbox'],
    reason:
      'Secure files require upload, scan, retention, and provider-backed evidence. There is no standalone file-purpose master model.',
  },
  {
    key: 'business-parties-and-baseline-projects',
    mode: 'SEEDED',
    dependsOn: ['companies', 'branches', 'qa-seed-audit-actor'],
    reason: 'Guarded deterministic Customer/Vendor and draft Project adapter.',
  },
  {
    key: 'project-stage-and-task-state-baseline',
    mode: 'CONTRACT_ONLY',
    dependsOn: ['stable-personas', 'business-parties-and-baseline-projects'],
    reason:
      'Project stages/tasks are command-owned. Direct seeding would bypass receipts and action events; IN_PROGRESS requires assignment, and WAITING_REVIEW requires a real submission and actor.',
  },
  {
    key: 'asset-and-software-licence-baseline',
    mode: 'SEEDED',
    dependsOn: ['companies', 'branches', 'departments'],
    reason:
      'Guarded deterministic asset taxonomy, available hardware, and unallocated software pool adapter.',
  },
  {
    key: 'encrypted-access-card-sample',
    mode: 'CONTRACT_ONLY',
    dependsOn: ['asset-and-software-licence-baseline', 'asset-encryption-keys'],
    reason:
      'An Access Card row requires the Asset command service to create an encrypted card envelope and versioned lookup index. The reference seeder must not manufacture ciphertext or key metadata.',
  },
  {
    key: 'controlled-synthetic-files',
    mode: 'CONTRACT_ONLY',
    dependsOn: ['file-provider-sandbox'],
    reason:
      'FileObject rows cannot be validly seeded without provider upload and malware-scan lifecycle evidence.',
  },
] satisfies ReadonlyArray<ReferenceLayerPlanEntry>);

export const REFERENCE_MASTER_DATA = Object.freeze({
  seedActor: {
    username: 'qa-reference-seed-actor',
    email: 'qa+reference-seed-actor@dsp-reference.invalid',
    displayName: 'QA Reference Seed Actor',
  },
  currencies: ['INR', 'AED'],
  moduleEntitlements: [
    {
      companyCode: 'DSP-IN-QA',
      modules: [
        'ASSETS',
        'DELIVERY',
        'FILE_STORAGE',
        'FINANCE',
        'ONBOARDING',
        'PAYROLL',
        'PROJECTS',
        'RECRUITMENT',
        'RECRUITMENT_SHORTLIST',
      ],
    },
    {
      companyCode: 'DSP-AE-QA',
      modules: [
        'ASSETS',
        'DELIVERY',
        'FILE_STORAGE',
        'FINANCE',
        'ONBOARDING',
        'PAYROLL',
        'PROJECTS',
        'RECRUITMENT',
        'RECRUITMENT_SHORTLIST',
      ],
    },
  ],
  finance: [
    {
      companyCode: 'DSP-IN-QA',
      baseCurrencyCode: 'INR',
      reportingStartDate: '2026-04-01',
      payrollExpenseCategoryCode: 'PAYROLL-EXPENSE-QA',
      categories: [
        {
          code: 'SERVICE-INCOME-QA',
          name: 'Service Income QA',
          type: 'INCOME',
        },
        {
          code: 'OPERATING-EXPENSE-QA',
          name: 'Operating Expense QA',
          type: 'EXPENSE',
        },
        {
          code: 'PAYROLL-EXPENSE-QA',
          name: 'Payroll Expense QA',
          type: 'EXPENSE',
        },
      ],
      accounts: [
        {
          code: 'PETTY-CASH-QA',
          name: 'Petty Cash QA',
          type: 'CASH',
          openingDate: '2026-04-01',
        },
        {
          code: 'BANK-CLEARING-QA',
          name: 'Bank Clearing QA',
          type: 'BANK',
          openingDate: '2026-04-01',
        },
      ],
      periods: [
        {
          year: 2026,
          month: 9,
          startDate: '2026-09-01',
          endDate: '2026-09-30',
        },
        {
          year: 2026,
          month: 10,
          startDate: '2026-10-01',
          endDate: '2026-10-31',
        },
      ],
      parties: [
        {
          code: 'CUSTOMER-NORTHSTAR-QA',
          name: 'Northstar Customer QA',
          type: 'CUSTOMER',
        },
        {
          code: 'VENDOR-OFFICE-QA',
          name: 'Office Supplies Vendor QA',
          type: 'VENDOR',
        },
      ],
    },
    {
      companyCode: 'DSP-AE-QA',
      baseCurrencyCode: 'AED',
      reportingStartDate: '2026-01-01',
      payrollExpenseCategoryCode: 'PAYROLL-EXPENSE-QA',
      categories: [
        {
          code: 'SERVICE-INCOME-QA',
          name: 'Service Income QA',
          type: 'INCOME',
        },
        {
          code: 'OPERATING-EXPENSE-QA',
          name: 'Operating Expense QA',
          type: 'EXPENSE',
        },
        {
          code: 'PAYROLL-EXPENSE-QA',
          name: 'Payroll Expense QA',
          type: 'EXPENSE',
        },
      ],
      accounts: [
        {
          code: 'PETTY-CASH-QA',
          name: 'Petty Cash QA',
          type: 'CASH',
          openingDate: '2026-01-01',
        },
        {
          code: 'BANK-CLEARING-QA',
          name: 'Bank Clearing QA',
          type: 'BANK',
          openingDate: '2026-01-01',
        },
      ],
      periods: [
        {
          year: 2026,
          month: 9,
          startDate: '2026-09-01',
          endDate: '2026-09-30',
        },
        {
          year: 2026,
          month: 10,
          startDate: '2026-10-01',
          endDate: '2026-10-31',
        },
      ],
      parties: [
        {
          code: 'CUSTOMER-GULF-QA',
          name: 'Gulf Customer QA',
          type: 'CUSTOMER',
        },
      ],
    },
  ],
  salaryComponents: [
    {
      companyCode: 'DSP-IN-QA',
      components: [
        { code: 'BASIC-QA', name: 'Basic Salary QA', type: 'EARNING' },
        { code: 'ALLOWANCE-QA', name: 'Allowance QA', type: 'EARNING' },
        { code: 'DEDUCTION-QA', name: 'Deduction QA', type: 'DEDUCTION' },
      ],
    },
    {
      companyCode: 'DSP-AE-QA',
      components: [
        { code: 'BASIC-QA', name: 'Basic Salary QA', type: 'EARNING' },
        { code: 'ALLOWANCE-QA', name: 'Allowance QA', type: 'EARNING' },
        { code: 'DEDUCTION-QA', name: 'Deduction QA', type: 'DEDUCTION' },
      ],
    },
  ],
  leave: [
    {
      companyCode: 'DSP-IN-QA',
      branchCodes: ['IN-KOCHI-HQ-QA', 'IN-BLR-DC-QA', 'IN-MUM-CS-QA'],
      types: [
        {
          code: 'ANNUAL-QA',
          name: 'Annual Leave QA',
          category: 'STANDARD',
          paid: true,
          halfDay: true,
          carryForward: true,
          annualEntitlement: 18,
          carryForwardLimit: 5,
        },
        {
          code: 'SICK-QA',
          name: 'Sick Leave QA',
          category: 'STANDARD',
          paid: true,
          halfDay: true,
          carryForward: false,
          annualEntitlement: 12,
          carryForwardLimit: null,
        },
        {
          code: 'UNPAID-QA',
          name: 'Unpaid Leave QA',
          category: 'UNPAID',
          paid: false,
          halfDay: true,
          carryForward: false,
          annualEntitlement: 365,
          carryForwardLimit: null,
        },
        {
          code: 'COMP-OFF-QA',
          name: 'Compensatory Off QA',
          category: 'COMP_OFF',
          paid: true,
          halfDay: true,
          carryForward: false,
          annualEntitlement: null,
          carryForwardLimit: null,
        },
      ],
    },
    {
      companyCode: 'DSP-AE-QA',
      branchCodes: ['AE-DXB-HQ-QA', 'AE-AUH-OPS-QA'],
      types: [
        {
          code: 'ANNUAL-QA',
          name: 'Annual Leave QA',
          category: 'STANDARD',
          paid: true,
          halfDay: true,
          carryForward: true,
          annualEntitlement: 30,
          carryForwardLimit: 5,
        },
        {
          code: 'SICK-QA',
          name: 'Sick Leave QA',
          category: 'STANDARD',
          paid: true,
          halfDay: true,
          carryForward: false,
          annualEntitlement: 15,
          carryForwardLimit: null,
        },
        {
          code: 'UNPAID-QA',
          name: 'Unpaid Leave QA',
          category: 'UNPAID',
          paid: false,
          halfDay: true,
          carryForward: false,
          annualEntitlement: 365,
          carryForwardLimit: null,
        },
        {
          code: 'COMP-OFF-QA',
          name: 'Compensatory Off QA',
          category: 'COMP_OFF',
          paid: true,
          halfDay: true,
          carryForward: false,
          annualEntitlement: null,
          carryForwardLimit: null,
        },
      ],
    },
  ],
  approvalWorkflows: [
    {
      companyCode: 'DSP-IN-QA',
      workflowCode: 'LEAVE_APPROVAL',
      workflowName: 'Leave Approval QA',
      steps: [
        { stepNo: 1, approverType: 'REPORTING_MANAGER', approverRole: null },
        { stepNo: 2, approverType: 'ROLE', approverRole: 'HR_MANAGER' },
      ],
    },
    {
      companyCode: 'DSP-IN-QA',
      workflowCode: 'OVERTIME_APPROVAL',
      workflowName: 'Overtime Approval QA',
      steps: [
        { stepNo: 1, approverType: 'REPORTING_MANAGER', approverRole: null },
        { stepNo: 2, approverType: 'ROLE', approverRole: 'HR_MANAGER' },
      ],
    },
    {
      companyCode: 'DSP-AE-QA',
      workflowCode: 'LEAVE_APPROVAL',
      workflowName: 'Leave Approval QA',
      steps: [
        { stepNo: 1, approverType: 'REPORTING_MANAGER', approverRole: null },
        { stepNo: 2, approverType: 'ROLE', approverRole: 'HR_MANAGER' },
      ],
    },
    {
      companyCode: 'DSP-AE-QA',
      workflowCode: 'OVERTIME_APPROVAL',
      workflowName: 'Overtime Approval QA',
      steps: [
        { stepNo: 1, approverType: 'REPORTING_MANAGER', approverRole: null },
        { stepNo: 2, approverType: 'ROLE', approverRole: 'HR_MANAGER' },
      ],
    },
  ],
  serviceOwnedApprovalControls: [
    {
      key: 'timesheet-manager',
      service: 'ProjectTimesheetCommandService',
      expectedControl:
        'Timesheet approval is performed by the snapshotted reporting Manager.',
      modelGap:
        'The timesheet command path does not resolve ApprovalWorkflow rows.',
    },
    {
      key: 'finance-independent-checker',
      service: 'OfficeFinanceTransactionsService',
      expectedControl:
        'Finance approval requires approval permission and an actor different from both creator and submitter.',
      modelGap:
        'Finance maker-checker is enforced by transaction ownership checks, not ApprovalWorkflow rows.',
    },
    {
      key: 'payroll-independent-checker',
      service: 'PayrollRunsService',
      expectedControl:
        'Payroll approval requires approval permission and an actor different from both creator and calculator.',
      modelGap:
        'Payroll maker-checker is enforced by run ownership checks, not ApprovalWorkflow rows.',
    },
    {
      key: 'asset-waiver-independent-checker',
      service: 'AssetClearanceService',
      expectedControl:
        'Sensitive Asset-waiver approval requires waiver permission and an actor different from the requester.',
      modelGap:
        'Asset-waiver maker-checker is enforced by the clearance service, not ApprovalWorkflow rows.',
    },
  ],
  onboardingTemplates: [
    {
      companyCode: 'DSP-IN-QA',
      templateCode: 'NEW-JOINER-QA',
      templateName: 'New Joiner Onboarding QA',
      versionNo: 1,
      intendedStatus: 'PUBLISHED',
      departments: [
        {
          branchCode: 'IN-KOCHI-HQ-QA',
          departmentCode: 'HR-QA',
          tasks: ['Verify employee details QA', 'Confirm joining documents QA'],
        },
        {
          branchCode: 'IN-KOCHI-HQ-QA',
          departmentCode: 'IT-ASSET-QA',
          tasks: ['Prepare laptop asset QA', 'Provision software access QA'],
        },
      ],
    },
    {
      companyCode: 'DSP-AE-QA',
      templateCode: 'NEW-JOINER-QA',
      templateName: 'New Joiner Onboarding QA',
      versionNo: 1,
      intendedStatus: 'PUBLISHED',
      departments: [
        {
          branchCode: 'AE-DXB-HQ-QA',
          departmentCode: 'HR-QA',
          tasks: ['Verify employee details QA', 'Confirm joining documents QA'],
        },
        {
          branchCode: 'AE-DXB-HQ-QA',
          departmentCode: 'IT-ASSET-QA',
          tasks: ['Prepare laptop asset QA', 'Provision software access QA'],
        },
      ],
    },
  ],
  projects: [
    {
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-MUM-CS-QA',
      partyCode: 'CUSTOMER-NORTHSTAR-QA',
      code: 'CLIENT-BASELINE-IN-QA',
      name: 'India Client Baseline QA',
      projectType: 'CLIENT',
      currencyCode: 'INR',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      expectedIncome: '100000.00',
      expenseBudget: '50000.00',
    },
    {
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-BLR-DC-QA',
      partyCode: null,
      code: 'INTERNAL-BASELINE-IN-QA',
      name: 'India Internal Baseline QA',
      projectType: 'INTERNAL',
      currencyCode: 'INR',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      expectedIncome: null,
      expenseBudget: '25000.00',
    },
    {
      companyCode: 'DSP-AE-QA',
      branchCode: 'AE-AUH-OPS-QA',
      partyCode: 'CUSTOMER-GULF-QA',
      code: 'CLIENT-BASELINE-AE-QA',
      name: 'UAE Client Baseline QA',
      projectType: 'CLIENT',
      currencyCode: 'AED',
      startDate: '2026-09-01',
      endDate: '2026-12-31',
      expectedIncome: '100000.00',
      expenseBudget: '50000.00',
    },
  ],
  projectExecutionScenarios: [
    {
      companyCode: 'DSP-IN-QA',
      projectCode: 'CLIENT-BASELINE-IN-QA',
      stage: { code: 'DELIVERY-QA', name: 'Delivery Stage QA' },
      tasks: [
        { code: 'OPEN-TASK-QA', name: 'Open Task QA', state: 'OPEN' },
        {
          code: 'IN-PROGRESS-TASK-QA',
          name: 'In Progress Task QA',
          state: 'IN_PROGRESS',
        },
        {
          code: 'WAITING-REVIEW-TASK-QA',
          name: 'Waiting Review Task QA',
          state: 'WAITING_REVIEW',
        },
      ],
    },
    {
      companyCode: 'DSP-IN-QA',
      projectCode: 'INTERNAL-BASELINE-IN-QA',
      stage: { code: 'DELIVERY-QA', name: 'Delivery Stage QA' },
      tasks: [
        { code: 'OPEN-TASK-QA', name: 'Open Task QA', state: 'OPEN' },
        {
          code: 'IN-PROGRESS-TASK-QA',
          name: 'In Progress Task QA',
          state: 'IN_PROGRESS',
        },
        {
          code: 'WAITING-REVIEW-TASK-QA',
          name: 'Waiting Review Task QA',
          state: 'WAITING_REVIEW',
        },
      ],
    },
    {
      companyCode: 'DSP-AE-QA',
      projectCode: 'CLIENT-BASELINE-AE-QA',
      stage: { code: 'DELIVERY-QA', name: 'Delivery Stage QA' },
      tasks: [
        { code: 'OPEN-TASK-QA', name: 'Open Task QA', state: 'OPEN' },
        {
          code: 'IN-PROGRESS-TASK-QA',
          name: 'In Progress Task QA',
          state: 'IN_PROGRESS',
        },
        {
          code: 'WAITING-REVIEW-TASK-QA',
          name: 'Waiting Review Task QA',
          state: 'WAITING_REVIEW',
        },
      ],
    },
  ],
  assets: [
    {
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-KOCHI-HQ-QA',
      departmentCode: 'IT-ASSET-QA',
      categories: [
        { code: 'HARDWARE-QA', name: 'Hardware QA' },
        { code: 'ACCESS-QA', name: 'Access Control QA' },
        { code: 'FACILITIES-QA', name: 'Facilities QA' },
        { code: 'SOFTWARE-QA', name: 'Software QA' },
      ],
      types: [
        {
          categoryCode: 'HARDWARE-QA',
          code: 'LAPTOP-QA',
          name: 'Laptop QA',
          kind: 'HARDWARE',
          trackingMode: 'INDIVIDUAL',
        },
        {
          categoryCode: 'ACCESS-QA',
          code: 'ACCESS-CARD-QA',
          name: 'Access Card QA',
          kind: 'CARD',
          trackingMode: 'INDIVIDUAL',
        },
        {
          categoryCode: 'FACILITIES-QA',
          code: 'OFFICE-EQUIPMENT-QA',
          name: 'Office Equipment QA',
          kind: 'GENERAL',
          trackingMode: 'LOCATION',
        },
        {
          categoryCode: 'SOFTWARE-QA',
          code: 'SAAS-LICENCE-QA',
          name: 'SaaS Licence QA',
          kind: 'SOFTWARE_LICENSE',
          trackingMode: 'POOL',
        },
      ],
      inventory: [
        {
          typeCode: 'LAPTOP-QA',
          code: 'LAPTOP-AVAILABLE-IN-QA',
          name: 'Available Laptop QA',
          serialNumber: 'QA-IN-LAPTOP-0001',
          location: null,
          softwareLicense: null,
        },
        {
          typeCode: 'LAPTOP-QA',
          code: 'LAPTOP-ONBOARDING-IN-QA',
          name: 'Onboarding Laptop QA',
          serialNumber: 'QA-IN-LAPTOP-0002',
          location: null,
          softwareLicense: null,
        },
        {
          typeCode: 'OFFICE-EQUIPMENT-QA',
          code: 'OFFICE-EQUIPMENT-IN-QA',
          name: 'Location-tracked Office Equipment QA',
          serialNumber: null,
          location: 'Kochi Storage QA',
          softwareLicense: null,
        },
        {
          typeCode: 'SAAS-LICENCE-QA',
          code: 'SAAS-POOL-IN-QA',
          name: 'SaaS Licence Pool QA',
          serialNumber: null,
          location: null,
          softwareLicense: {
            vendorName: 'Synthetic Software Vendor QA',
            productName: 'Collaboration Suite QA',
            contractReference: 'QA-IN-SAAS-CONTRACT',
            seatCapacity: 2,
          },
        },
      ],
    },
    {
      companyCode: 'DSP-AE-QA',
      branchCode: 'AE-DXB-HQ-QA',
      departmentCode: 'IT-ASSET-QA',
      categories: [
        { code: 'HARDWARE-QA', name: 'Hardware QA' },
        { code: 'SOFTWARE-QA', name: 'Software QA' },
      ],
      types: [
        {
          categoryCode: 'HARDWARE-QA',
          code: 'LAPTOP-QA',
          name: 'Laptop QA',
          kind: 'HARDWARE',
          trackingMode: 'INDIVIDUAL',
        },
        {
          categoryCode: 'SOFTWARE-QA',
          code: 'SAAS-LICENCE-QA',
          name: 'SaaS Licence QA',
          kind: 'SOFTWARE_LICENSE',
          trackingMode: 'POOL',
        },
      ],
      inventory: [
        {
          typeCode: 'LAPTOP-QA',
          code: 'LAPTOP-AVAILABLE-AE-QA',
          name: 'Available Laptop QA',
          serialNumber: 'QA-AE-LAPTOP-0001',
          location: null,
          softwareLicense: null,
        },
        {
          typeCode: 'SAAS-LICENCE-QA',
          code: 'SAAS-POOL-AE-QA',
          name: 'SaaS Licence Pool QA',
          serialNumber: null,
          location: null,
          softwareLicense: {
            vendorName: 'Synthetic Software Vendor QA',
            productName: 'Collaboration Suite QA',
            contractReference: 'QA-AE-SAAS-CONTRACT',
            seatCapacity: 2,
          },
        },
      ],
    },
  ],
  encryptedAccessCardSamples: [
    {
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-KOCHI-HQ-QA',
      departmentCode: 'IT-ASSET-QA',
      typeCode: 'ACCESS-CARD-QA',
      code: 'ACCESS-CARD-IN-QA',
      name: 'Access Card QA',
      intendedStatus: 'AVAILABLE',
    },
  ],
});

export function buildReferenceMasterDataPlan() {
  const counts: Record<string, number> = {
    'company-module-entitlements':
      REFERENCE_MASTER_DATA.moduleEntitlements.length,
    'currency-catalog': REFERENCE_MASTER_DATA.currencies.length,
    'normal-and-overnight-shifts': 4,
    'monday-friday-branch-working-calendars': 42,
    'reviewed-country-holidays': 0,
    'financial-profiles-categories-accounts-and-open-periods':
      REFERENCE_MASTER_DATA.finance.reduce(
        (total, company) =>
          total +
          1 +
          company.categories.length +
          company.accounts.length +
          company.periods.length,
        0,
      ),
    'salary-components': REFERENCE_MASTER_DATA.salaryComponents.reduce(
      (total, company) => total + company.components.length,
      0,
    ),
    'effective-salaries-and-tax-profiles': 0,
    'leave-types-and-branch-policies': REFERENCE_MASTER_DATA.leave.reduce(
      (total, company) =>
        total +
        company.types.length +
        company.types.filter((type) => type.annualEntitlement !== null).length *
          company.branchCodes.length,
      0,
    ),
    'attendance-and-overtime-policies': 0,
    'workforce-approval-routes': REFERENCE_MASTER_DATA.approvalWorkflows.reduce(
      (total, workflow) => total + 1 + workflow.steps.length,
      0,
    ),
    'service-owned-independent-approval-controls':
      REFERENCE_MASTER_DATA.serviceOwnedApprovalControls.length,
    'published-onboarding-templates':
      REFERENCE_MASTER_DATA.onboardingTemplates.length,
    'secure-file-purposes-and-recruitment-document-mappings': 0,
    'business-parties-and-baseline-projects':
      REFERENCE_MASTER_DATA.finance.reduce(
        (total, company) => total + company.parties.length,
        0,
      ) + REFERENCE_MASTER_DATA.projects.length,
    'project-stage-and-task-state-baseline':
      REFERENCE_MASTER_DATA.projectExecutionScenarios.reduce(
        (total, scenario) => total + 1 + scenario.tasks.length,
        0,
      ),
    'asset-and-software-licence-baseline': REFERENCE_MASTER_DATA.assets.reduce(
      (total, company) =>
        total +
        company.categories.length +
        company.types.length +
        company.inventory.length +
        company.inventory.filter((asset) => asset.softwareLicense !== null)
          .length,
      0,
    ),
    'encrypted-access-card-sample':
      REFERENCE_MASTER_DATA.encryptedAccessCardSamples.length,
    'controlled-synthetic-files': 0,
  };

  return REFERENCE_LAYER_PLAN.map((layer) => ({
    ...layer,
    itemCount: counts[layer.key] ?? 0,
  }));
}

function assertUnique(values: ReadonlyArray<string>, label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate values.`);
  }
}

function assertQaCode(value: string, label: string): void {
  if (!value.endsWith('-QA')) {
    throw new Error(`${label} must end with -QA.`);
  }
}

function assertIsoDate(value: string, label: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be an ISO date.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date.`);
  }
}

export function validateReferenceMasterData(
  companyCodes: ReadonlySet<string>,
  branchCodesByCompany: ReadonlyMap<string, ReadonlySet<string>>,
  departmentCodesByCompanyBranch: ReadonlyMap<string, ReadonlySet<string>>,
): void {
  assertUnique(
    REFERENCE_LAYER_PLAN.map((layer) => layer.key),
    'Reference layer keys',
  );
  for (const layer of REFERENCE_LAYER_PLAN) {
    if (!layer.reason.trim()) {
      throw new Error(`${layer.key} requires an implementation reason.`);
    }
  }

  if (
    !REFERENCE_MASTER_DATA.seedActor.email.endsWith('@dsp-reference.invalid')
  ) {
    throw new Error('QA seed actor must use the synthetic .invalid domain.');
  }
  if (
    !REFERENCE_MASTER_DATA.seedActor.username.startsWith('qa-') ||
    !REFERENCE_MASTER_DATA.seedActor.displayName.includes('QA')
  ) {
    throw new Error('QA seed actor must be visibly marked as QA.');
  }
  assertUnique(REFERENCE_MASTER_DATA.currencies, 'Currency codes');
  for (const currencyCode of REFERENCE_MASTER_DATA.currencies) {
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      throw new Error(`Invalid contracted currency code ${currencyCode}.`);
    }
  }

  for (const entitlement of REFERENCE_MASTER_DATA.moduleEntitlements) {
    if (!companyCodes.has(entitlement.companyCode)) {
      throw new Error(
        `Module entitlement references unknown Company ${entitlement.companyCode}.`,
      );
    }
    assertUnique(
      entitlement.modules,
      `${entitlement.companyCode} module entitlement keys`,
    );
  }

  for (const finance of REFERENCE_MASTER_DATA.finance) {
    if (!companyCodes.has(finance.companyCode)) {
      throw new Error(
        `Finance references unknown Company ${finance.companyCode}.`,
      );
    }
    if (!/^[A-Z]{3}$/.test(finance.baseCurrencyCode)) {
      throw new Error(`${finance.companyCode} has an invalid currency code.`);
    }
    if (!REFERENCE_MASTER_DATA.currencies.includes(finance.baseCurrencyCode)) {
      throw new Error(`${finance.companyCode} uses an uncontracted currency.`);
    }
    assertIsoDate(
      finance.reportingStartDate,
      `${finance.companyCode} reportingStartDate`,
    );
    assertUnique(
      finance.categories.map((row) => row.code),
      `${finance.companyCode} Finance category codes`,
    );
    assertUnique(
      finance.accounts.map((row) => row.code),
      `${finance.companyCode} Finance account codes`,
    );
    assertUnique(
      finance.parties.map((row) => row.code),
      `${finance.companyCode} Business Party codes`,
    );
    for (const row of [
      ...finance.categories,
      ...finance.accounts,
      ...finance.parties,
    ]) {
      assertQaCode(row.code, `${finance.companyCode} ${row.code}`);
      if (!row.name.endsWith('QA')) {
        throw new Error(
          `${finance.companyCode} ${row.code} name is not QA-marked.`,
        );
      }
    }
    if (
      !finance.categories.some(
        (category) =>
          category.code === finance.payrollExpenseCategoryCode &&
          category.type === 'EXPENSE',
      )
    ) {
      throw new Error(
        `${finance.companyCode} payroll expense category is missing or not EXPENSE.`,
      );
    }
    for (const period of finance.periods) {
      assertIsoDate(period.startDate, `${finance.companyCode} period start`);
      assertIsoDate(period.endDate, `${finance.companyCode} period end`);
      if (period.month < 1 || period.month > 12) {
        throw new Error(`${finance.companyCode} has an invalid period month.`);
      }
    }
  }

  for (const salary of REFERENCE_MASTER_DATA.salaryComponents) {
    if (!companyCodes.has(salary.companyCode)) {
      throw new Error(
        `Salary components reference unknown Company ${salary.companyCode}.`,
      );
    }
    assertUnique(
      salary.components.map((row) => row.code),
      `${salary.companyCode} Salary component codes`,
    );
    for (const component of salary.components) {
      assertQaCode(component.code, `${salary.companyCode} Salary component`);
      if (!component.name.endsWith('QA')) {
        throw new Error(`${component.code} name is not QA-marked.`);
      }
    }
  }

  for (const leave of REFERENCE_MASTER_DATA.leave) {
    if (!companyCodes.has(leave.companyCode)) {
      throw new Error(`Leave references unknown Company ${leave.companyCode}.`);
    }
    assertUnique(
      leave.types.map((row) => row.code),
      `${leave.companyCode} Leave Type codes`,
    );
    assertUnique(
      leave.branchCodes,
      `${leave.companyCode} Leave policy Branches`,
    );
    for (const branchCode of leave.branchCodes) {
      if (!branchCodesByCompany.get(leave.companyCode)?.has(branchCode)) {
        throw new Error(
          `${leave.companyCode} Leave policy references unknown Branch ${branchCode}.`,
        );
      }
    }
    for (const type of leave.types) {
      assertQaCode(type.code, `${leave.companyCode} Leave Type`);
      if (!type.name.endsWith('QA')) {
        throw new Error(`${type.code} name is not QA-marked.`);
      }
      if (type.annualEntitlement !== null && type.annualEntitlement <= 0) {
        throw new Error(`${type.code} annual entitlement must be positive.`);
      }
      if (type.category === 'COMP_OFF' && type.annualEntitlement !== null) {
        throw new Error(`${type.code} must not have a fixed annual policy.`);
      }
    }
  }

  assertUnique(
    REFERENCE_MASTER_DATA.approvalWorkflows.map(
      (workflow) => `${workflow.companyCode}:${workflow.workflowCode}`,
    ),
    'Approval workflow Company/code pairs',
  );
  for (const workflow of REFERENCE_MASTER_DATA.approvalWorkflows) {
    if (!companyCodes.has(workflow.companyCode)) {
      throw new Error(
        `Approval workflow references unknown Company ${workflow.companyCode}.`,
      );
    }
    if (!workflow.workflowName.endsWith('QA')) {
      throw new Error(`${workflow.workflowCode} name is not QA-marked.`);
    }
    assertUnique(
      workflow.steps.map((step) => String(step.stepNo)),
      `${workflow.companyCode} Approval workflow step numbers`,
    );
    if (workflow.steps.some((step, index) => step.stepNo !== index + 1)) {
      throw new Error(
        `${workflow.companyCode} Approval steps must be contiguous.`,
      );
    }
    if (
      workflow.steps.length !== 2 ||
      workflow.steps[0]?.approverType !== 'REPORTING_MANAGER' ||
      workflow.steps[0]?.approverRole !== null ||
      workflow.steps[1]?.approverType !== 'ROLE' ||
      workflow.steps[1]?.approverRole !== 'HR_MANAGER'
    ) {
      throw new Error(
        `${workflow.companyCode} ${workflow.workflowCode} must route Manager then HR.`,
      );
    }
  }

  assertUnique(
    REFERENCE_MASTER_DATA.serviceOwnedApprovalControls.map(
      (control) => control.key,
    ),
    'Service-owned approval control keys',
  );
  for (const control of REFERENCE_MASTER_DATA.serviceOwnedApprovalControls) {
    if (
      !control.service.trim() ||
      !control.expectedControl.trim() ||
      !control.modelGap.trim()
    ) {
      throw new Error(
        `${control.key} requires a service, expected control, and model gap.`,
      );
    }
  }

  for (const template of REFERENCE_MASTER_DATA.onboardingTemplates) {
    if (!companyCodes.has(template.companyCode)) {
      throw new Error(
        `Onboarding Template references unknown Company ${template.companyCode}.`,
      );
    }
    assertQaCode(template.templateCode, `${template.companyCode} template`);
    if (!template.templateName.endsWith('QA')) {
      throw new Error(`${template.templateCode} name is not QA-marked.`);
    }
    for (const department of template.departments) {
      if (
        !branchCodesByCompany
          .get(template.companyCode)
          ?.has(department.branchCode)
      ) {
        throw new Error(
          `${template.templateCode} references unknown Branch ${department.branchCode}.`,
        );
      }
      if (
        !departmentCodesByCompanyBranch
          .get(`${template.companyCode}:${department.branchCode}`)
          ?.has(department.departmentCode)
      ) {
        throw new Error(
          `${template.templateCode} references unknown Department ${department.departmentCode}.`,
        );
      }
      if (department.tasks.some((task) => !task.endsWith('QA'))) {
        throw new Error(
          `${template.templateCode} contains a non-QA task name.`,
        );
      }
    }
  }

  const partyCodesByCompany = new Map(
    REFERENCE_MASTER_DATA.finance.map((finance) => [
      finance.companyCode,
      new Set(finance.parties.map((party) => party.code)),
    ]),
  );
  assertUnique(
    REFERENCE_MASTER_DATA.projects.map(
      (project) => `${project.companyCode}:${project.code}`,
    ),
    'Project Company/code pairs',
  );
  for (const project of REFERENCE_MASTER_DATA.projects) {
    if (!companyCodes.has(project.companyCode)) {
      throw new Error(
        `Project references unknown Company ${project.companyCode}.`,
      );
    }
    if (
      !branchCodesByCompany.get(project.companyCode)?.has(project.branchCode)
    ) {
      throw new Error(`${project.code} references an unknown Branch.`);
    }
    assertQaCode(project.code, `${project.companyCode} Project`);
    if (!project.name.endsWith('QA')) {
      throw new Error(`${project.code} name is not QA-marked.`);
    }
    if (!REFERENCE_MASTER_DATA.currencies.includes(project.currencyCode)) {
      throw new Error(`${project.code} uses an uncontracted currency.`);
    }
    if (
      project.partyCode !== null &&
      !partyCodesByCompany.get(project.companyCode)?.has(project.partyCode)
    ) {
      throw new Error(`${project.code} references an unknown Business Party.`);
    }
    assertIsoDate(project.startDate, `${project.code} startDate`);
    assertIsoDate(project.endDate, `${project.code} endDate`);
  }

  assertUnique(
    REFERENCE_MASTER_DATA.projectExecutionScenarios.map(
      (scenario) => `${scenario.companyCode}:${scenario.projectCode}`,
    ),
    'Project execution scenarios',
  );
  const requiredTaskStates = new Set(['OPEN', 'IN_PROGRESS', 'WAITING_REVIEW']);
  for (const scenario of REFERENCE_MASTER_DATA.projectExecutionScenarios) {
    if (
      !REFERENCE_MASTER_DATA.projects.some(
        (project) =>
          project.companyCode === scenario.companyCode &&
          project.code === scenario.projectCode,
      )
    ) {
      throw new Error(
        `${scenario.projectCode} execution scenario references an unknown Project.`,
      );
    }
    assertQaCode(scenario.stage.code, `${scenario.projectCode} Project Stage`);
    if (!scenario.stage.name.endsWith('QA')) {
      throw new Error(`${scenario.projectCode} stage name is not QA-marked.`);
    }
    assertUnique(
      scenario.tasks.map((task) => task.code),
      `${scenario.projectCode} Project Task codes`,
    );
    if (
      scenario.tasks.length !== requiredTaskStates.size ||
      scenario.tasks.some((task) => !requiredTaskStates.has(task.state)) ||
      new Set(scenario.tasks.map((task) => task.state)).size !==
        requiredTaskStates.size
    ) {
      throw new Error(
        `${scenario.projectCode} must contract OPEN, IN_PROGRESS, and WAITING_REVIEW tasks exactly once.`,
      );
    }
    for (const task of scenario.tasks) {
      assertQaCode(task.code, `${scenario.projectCode} Project Task`);
      if (!task.name.endsWith('QA')) {
        throw new Error(`${task.code} name is not QA-marked.`);
      }
    }
  }

  for (const assetCompany of REFERENCE_MASTER_DATA.assets) {
    if (!companyCodes.has(assetCompany.companyCode)) {
      throw new Error(
        `Asset baseline references unknown Company ${assetCompany.companyCode}.`,
      );
    }
    if (
      !branchCodesByCompany
        .get(assetCompany.companyCode)
        ?.has(assetCompany.branchCode)
    ) {
      throw new Error(`${assetCompany.companyCode} asset Branch is unknown.`);
    }
    if (
      !departmentCodesByCompanyBranch
        .get(`${assetCompany.companyCode}:${assetCompany.branchCode}`)
        ?.has(assetCompany.departmentCode)
    ) {
      throw new Error(
        `${assetCompany.companyCode} asset Department is unknown.`,
      );
    }
    assertUnique(
      assetCompany.categories.map((row) => row.code),
      `${assetCompany.companyCode} Asset Category codes`,
    );
    assertUnique(
      assetCompany.types.map((row) => row.code),
      `${assetCompany.companyCode} Asset Type codes`,
    );
    assertUnique(
      assetCompany.inventory.map((row) => row.code),
      `${assetCompany.companyCode} Asset codes`,
    );
    for (const code of [
      ...assetCompany.categories.map((row) => row.code),
      ...assetCompany.types.map((row) => row.code),
      ...assetCompany.inventory.map((row) => row.code),
    ]) {
      assertQaCode(code, `${assetCompany.companyCode} Asset definition`);
    }
    for (const name of [
      ...assetCompany.categories.map((row) => row.name),
      ...assetCompany.types.map((row) => row.name),
      ...assetCompany.inventory.map((row) => row.name),
    ]) {
      if (!name.endsWith('QA')) {
        throw new Error(
          `${assetCompany.companyCode} Asset name is not QA-marked.`,
        );
      }
    }
    for (const type of assetCompany.types) {
      if (
        !assetCompany.categories.some(
          (category) => category.code === type.categoryCode,
        )
      ) {
        throw new Error(`${type.code} references an unknown Asset Category.`);
      }
      if (type.kind === 'SOFTWARE_LICENSE' && type.trackingMode !== 'POOL') {
        throw new Error(
          `${type.code} software licence must use POOL tracking.`,
        );
      }
      if (type.kind === 'HARDWARE' && type.trackingMode !== 'INDIVIDUAL') {
        throw new Error(`${type.code} hardware must use INDIVIDUAL tracking.`);
      }
      if (type.kind === 'CARD' && type.trackingMode !== 'INDIVIDUAL') {
        throw new Error(`${type.code} card must use INDIVIDUAL tracking.`);
      }
      if (type.kind === 'GENERAL' && type.trackingMode !== 'LOCATION') {
        throw new Error(
          `${type.code} general asset must use LOCATION tracking.`,
        );
      }
    }
    for (const inventory of assetCompany.inventory) {
      const type = assetCompany.types.find(
        (candidate) => candidate.code === inventory.typeCode,
      );
      if (!type) {
        throw new Error(`${inventory.code} references an unknown Asset Type.`);
      }
      if ((type.kind === 'SOFTWARE_LICENSE') !== !!inventory.softwareLicense) {
        throw new Error(
          `${inventory.code} has invalid software licence metadata.`,
        );
      }
      if (
        inventory.softwareLicense &&
        (!inventory.softwareLicense.vendorName.endsWith('QA') ||
          !inventory.softwareLicense.productName.endsWith('QA'))
      ) {
        throw new Error(
          `${inventory.code} software licence metadata is not QA-marked.`,
        );
      }
      if (type.kind === 'HARDWARE' && !inventory.serialNumber) {
        throw new Error(`${inventory.code} hardware requires a serial number.`);
      }
      if (type.trackingMode === 'LOCATION' && !inventory.location) {
        throw new Error(
          `${inventory.code} location-tracked asset needs a location.`,
        );
      }
      if (
        inventory.softwareLicense &&
        inventory.softwareLicense.seatCapacity !== 2
      ) {
        throw new Error(
          `${inventory.code} QA licence pool capacity must be two.`,
        );
      }
    }
  }

  assertUnique(
    REFERENCE_MASTER_DATA.encryptedAccessCardSamples.map(
      (sample) => `${sample.companyCode}:${sample.code}`,
    ),
    'Encrypted Access Card samples',
  );
  for (const sample of REFERENCE_MASTER_DATA.encryptedAccessCardSamples) {
    const assetCompany = REFERENCE_MASTER_DATA.assets.find(
      (candidate) => candidate.companyCode === sample.companyCode,
    );
    if (!assetCompany) {
      throw new Error(`${sample.code} references an unknown Asset Company.`);
    }
    if (
      assetCompany.branchCode !== sample.branchCode ||
      assetCompany.departmentCode !== sample.departmentCode
    ) {
      throw new Error(`${sample.code} references an unknown Asset scope.`);
    }
    const type = assetCompany.types.find(
      (candidate) => candidate.code === sample.typeCode,
    );
    if (!type || type.kind !== 'CARD' || type.trackingMode !== 'INDIVIDUAL') {
      throw new Error(`${sample.code} requires an INDIVIDUAL CARD Asset Type.`);
    }
    assertQaCode(sample.code, `${sample.companyCode} encrypted Access Card`);
    if (!sample.name.endsWith('QA')) {
      throw new Error(`${sample.code} name is not QA-marked.`);
    }
  }
}
