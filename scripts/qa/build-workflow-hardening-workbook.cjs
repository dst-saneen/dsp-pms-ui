const fs = require('node:fs/promises');
const path = require('node:path');
const { FileBlob, SpreadsheetFile } = require('@oai/artifact-tool');

const root = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(
  root,
  'docs',
  'reference',
  'production-fix-improvement-plan-2026-09-09.xlsx',
);
const outputDir = path.join(
  root,
  'outputs',
  '01a0adf3-c043-7dd2-8224-025672d2f8a0',
);
const outputPath = path.join(
  outputDir,
  'DSP-ERP-Workflow-Hardening-and-Test-Plan-2026-09-17.xlsx',
);
const previewDir = path.join(outputDir, 'previews');

// This browser smoke suite is authenticated surface evidence. It is not
// completion evidence for any of the 12 end-to-end golden threads below.
const AUTHENTICATED_BROWSER_SMOKE = Object.freeze({
  passed: 59,
  failed: 0,
  notRun: 3,
  total: 62,
  evidenceFile:
    'backend/.qa-runs/authenticated-smoke-playwright-20260918T104017949Z-9975f254.log',
});
const AUTHENTICATED_BROWSER_SMOKE_SCOPE =
  'The 2026-09-18 authenticated surface smoke completed with 69 canonical routes discovered, 68 audited, 0 unavailable, one planned/disabled route excluded, and 73 unique internal links audited. Three live Finance/Payroll mutation cases were deliberately skipped because they require an exact transaction manifest and cleanup. This historical run predates the Approval workflows route and does not complete any golden thread.';
const ROUTES_ADDED_AFTER_AUTHENTICATED_SMOKE = new Set([
  '/administration/approval-workflows',
]);

const PERSONA_APPLY_EVIDENCE =
  'backend/.qa-runs/reference-seed-1789728103852.json';
const PERSONA_RERUN_EVIDENCE =
  'backend/.qa-runs/reference-seed-1789728130663.json';
const FINAL_STAGING_AUDIT_EVIDENCE =
  'backend/.qa-runs/staging-audit-1790070324845.json';
const FINAL_CURRENT_SCHEMA_EVIDENCE =
  'backend/.qa-runs/current-structure-verification-1790070352149.json';
const CURRENT_SCHEMA_SHA256 =
  'd26cbfed33058fcf51dba67a498ef4899ed9b060d2b4b9aecce10304d9112e71';
const STAGING_SCHEMA_SHA256 =
  '91fd7193fdb19f05b5752e1b145e0ba7695e4b35b3eceb1c18b1dbdd49f42722';
const FINAL_STAGING_STRUCTURE_EVIDENCE =
  'backend/.qa-runs/staging-baseline/structure-staging-final-2026-09-18T10-20-02-545Z.json';
const FINAL_STAGING_STRUCTURE_SHA256 =
  '7f997328822a67cbae099700e10251a33c45a70db1042d14d420f1610b5f12ef';

function hasAuthenticatedBrowserSmokeResult() {
  return ['passed', 'failed', 'notRun'].every((key) =>
    Number.isInteger(AUTHENTICATED_BROWSER_SMOKE[key]),
  );
}

function validateAuthenticatedBrowserSmoke() {
  const resultFields = ['passed', 'failed', 'notRun'];
  const populated = resultFields.filter((key) =>
    Number.isInteger(AUTHENTICATED_BROWSER_SMOKE[key]),
  );
  if (populated.length !== 0 && populated.length !== resultFields.length) {
    throw new Error(
      'Authenticated browser smoke counts must be all null or all integers.',
    );
  }
  if (!hasAuthenticatedBrowserSmokeResult()) return;

  const values = resultFields.map(
    (key) => AUTHENTICATED_BROWSER_SMOKE[key],
  );
  if (values.some((value) => value < 0)) {
    throw new Error('Authenticated browser smoke counts cannot be negative.');
  }
  const observedTotal = values.reduce((sum, value) => sum + value, 0);
  if (observedTotal !== AUTHENTICATED_BROWSER_SMOKE.total) {
    throw new Error(
      `Authenticated browser smoke counts total ${observedTotal}; expected ${AUTHENTICATED_BROWSER_SMOKE.total}.`,
    );
  }
  if (!AUTHENTICATED_BROWSER_SMOKE.evidenceFile.trim()) {
    throw new Error(
      'Authenticated browser smoke evidenceFile is required with final counts.',
    );
  }
}

function browserSmokeCountText() {
  if (!hasAuthenticatedBrowserSmokeResult()) {
    return `${AUTHENTICATED_BROWSER_SMOKE.total}-case rerun pending`;
  }
  const { passed, failed, notRun, total } = AUTHENTICATED_BROWSER_SMOKE;
  return `${passed} passed; ${failed} failed; ${notRun} skipped (${total} total)`;
}

function browserSmokeStatus() {
  if (!hasAuthenticatedBrowserSmokeResult()) return 'Active rerun pending';
  if (AUTHENTICATED_BROWSER_SMOKE.failed > 0) return 'Failed';
  if (AUTHENTICATED_BROWSER_SMOKE.notRun > 0) return 'Incomplete';
  return 'Passed';
}

function browserSmokeEvidencePath() {
  const evidenceFile = AUTHENTICATED_BROWSER_SMOKE.evidenceFile.trim();
  if (!evidenceFile) return '';
  if (evidenceFile.includes('/') || evidenceFile.includes('\\')) {
    return evidenceFile.replaceAll('\\', '/');
  }
  return `backend/.qa-runs/${evidenceFile}`;
}

function browserSmokeRunIdentifier() {
  const match = AUTHENTICATED_BROWSER_SMOKE.evidenceFile.match(
    /authenticated-smoke-playwright-(\d{8}T\d{9}Z-[a-f0-9]{8})\.log$/i,
  );
  return match ? `QA-auth-smoke-${match[1]}` : 'Pending active rerun';
}

const NAV_ORDER = [
  'Dashboard',
  'My Work',
  'People',
  'Recruitment',
  'Workforce',
  'Payroll',
  'Projects',
  'Finance',
  'Assets & Licences',
  'Setup',
  'Operations',
  'Security',
];

function routeSection(href) {
  if (href === '/dashboard') return 'Dashboard';
  if (href.startsWith('/my-workspace')) return 'My Work';
  if (
    href.startsWith('/hr/employees') ||
    href.startsWith('/hr/employee-onboarding') ||
    href.startsWith('/hr/hr-requests') ||
    href.startsWith('/hr/employee-separations') ||
    href.startsWith('/hr/employee-documents')
  ) return 'People';
  if (href.startsWith('/hr/recruitment')) return 'Recruitment';
  if (href.startsWith('/hr/payroll')) return 'Payroll';
  if (href.startsWith('/projects')) return 'Projects';
  if (href.startsWith('/office-finance')) return 'Finance';
  if (href.startsWith('/asset-management')) return 'Assets & Licences';
  if (
    href.includes('delivery') ||
    href.includes('dead-letter') ||
    href.includes('suppression') ||
    href.includes('recipient-exception') ||
    href.includes('file-reconciliation')
  ) return 'Operations';
  if (
    href.includes('/users') ||
    href.includes('/roles') ||
    href.includes('/sessions') ||
    href.includes('/retention')
  ) return 'Security';
  if (
    href.startsWith('/administration') ||
    href.includes('/settings') ||
    href.includes('/policies') ||
    href.includes('/configuration') ||
    href.includes('/templates') ||
    href.includes('/designations') ||
    href.includes('/departments') ||
    href.includes('/branches') ||
    href.includes('/companies')
  ) return 'Setup';
  return 'Workforce';
}

async function extractNavigationRoutes() {
  const source = await fs.readFile(
    path.join(root, 'frontend', 'config', 'navigation.ts'),
    'utf8',
  );
  const rows = [];
  const hrefPattern = /href:\s*"([^"]+)"/g;
  let match;
  while ((match = hrefPattern.exec(source)) !== null) {
    const start = source.lastIndexOf('{', match.index);
    const end = source.indexOf('},', match.index);
    const objectText = source.slice(start, end === -1 ? match.index + 500 : end);
    const title = objectText.match(/title:\s*"([^"]+)"/)?.[1] ?? match[1];
    const permissions = [
      ...objectText.matchAll(/"([a-z][a-z0-9.-]+)"/g),
    ]
      .map((candidate) => candidate[1])
      .filter((value) => value.includes('.'));
    const capability = objectText.match(/moduleCapability:\s*"([^"]+)"/)?.[1];
    const featureFlag = objectText.match(/featureFlag:\s*"([^"]+)"/)?.[1];
    const availability = objectText.match(/availability:\s*"([^"]+)"/)?.[1];
    rows.push({
      title,
      href: match[1],
      section: routeSection(match[1]),
      access: [...new Set(permissions)].join(' OR ') || 'Authenticated route policy',
      capability: capability ?? featureFlag ?? 'None',
      availability: availability ?? 'active',
    });
  }

  const duplicateHrefs = [...new Set(
    rows
      .map((row) => row.href)
      .filter((href, index, hrefs) => hrefs.indexOf(href) !== index),
  )];
  if (duplicateHrefs.length) {
    throw new Error(
      `Navigation contains duplicate routes: ${duplicateHrefs.join(', ')}.`,
    );
  }
  const unique = [...new Map(rows.map((row) => [row.href, row])).values()];
  if (!unique.length) {
    throw new Error('Navigation contains no routes.');
  }
  return unique.sort((left, right) => {
    const section = NAV_ORDER.indexOf(left.section) - NAV_ORDER.indexOf(right.section);
    return section || left.href.localeCompare(right.href);
  });
}

function navigationInventory(routes) {
  const planned = routes.filter(
    (route) => route.availability === 'planned',
  ).length;
  const pendingAuthenticatedAudit = routes.filter((route) =>
    ROUTES_ADDED_AFTER_AUTHENTICATED_SMOKE.has(route.href),
  ).length;
  return {
    total: routes.length,
    auditable: routes.length - planned,
    planned,
    pendingAuthenticatedAudit,
  };
}

function sheetTitle(sheet, title, subtitle, context, columns, rows, widths) {
  const columnCount = columns.length;
  const lastColumn = columnName(columnCount);
  sheet.showGridLines = false;
  sheet.getRange(`A1:${lastColumn}1`).format.borders = {
    bottom: { style: 'thin', color: '#9FB3C8' },
  };
  sheet.getRange('A1').values = [[title]];
  sheet.getRange('A1').format.font = {
    name: 'Arial',
    size: 16,
    bold: true,
    color: '#17365D',
  };
  sheet.getRange('A2').values = [[subtitle]];
  sheet.getRange('A2').format.font = {
    name: 'Arial',
    size: 10,
    italic: true,
    color: '#53677A',
  };
  sheet.getRange('A3').values = [[context]];
  sheet.getRange('A3').format.font = {
    name: 'Arial',
    size: 9,
    color: '#6B7280',
  };
  sheet.getRangeByIndexes(4, 0, 1, columnCount).values = [columns];
  sheet.getRangeByIndexes(4, 0, 1, columnCount).format = {
    fill: '#1F4E78',
    font: { name: 'Arial', size: 9, bold: true, color: '#FFFFFF' },
    verticalAlignment: 'center',
    horizontalAlignment: 'center',
    wrapText: true,
    borders: { preset: 'inside', style: 'thin', color: '#FFFFFF' },
  };
  if (rows.length) {
    sheet.getRangeByIndexes(5, 0, rows.length, columnCount).values = rows;
    const body = sheet.getRangeByIndexes(5, 0, rows.length, columnCount);
    body.format.font = { name: 'Arial', size: 9, color: '#1F2937' };
    body.format.verticalAlignment = 'top';
    body.format.wrapText = true;
    body.format.borders = {
      insideHorizontal: { style: 'thin', color: '#E5E7EB' },
    };
    const table = sheet.tables.add(
      `A5:${lastColumn}${rows.length + 5}`,
      true,
      `T_${sheet.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 22)}`,
    );
    table.style = 'TableStyleMedium2';
    table.showBandedColumns = false;
  }
  widths.forEach((width, index) => {
    sheet
      .getRangeByIndexes(0, index, Math.max(rows.length + 5, 6), 1)
      .format.columnWidth = width;
  });
  sheet.getRange('1:1').format.rowHeight = 24;
  sheet.getRange('2:3').format.rowHeight = 18;
  sheet.getRange('5:5').format.rowHeight = 32;
  sheet.freezePanes.freezeRows(5);
}

function columnName(count) {
  let result = '';
  let value = count;
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function referenceDataRows() {
  return [
    ['Tenant boundary', 'Company Group', 'Stable master', 'One customer tenant; all Company data remains inside the group.', 'Direct-ID denial across DSP Reference Group QA and DSP Isolation Group QA.', 'Approved contract'],
    ['Legal entity', 'Company', 'Stable master', 'One legal entity with explicit legal country; finance profile owns currency/reporting period.', 'India and UAE Companies required before E2E.', 'Approved contract'],
    ['Operating location', 'Branch', 'Stable master', 'Company-owned location with country, subdivision, IANA timezone and reviewed workweek.', 'Five primary branches plus one isolation branch.', 'Approved contract'],
    ['Functional unit', 'Department', 'Stable master', 'Branch-specific; no generic team/business-unit engine in this phase.', 'Department branchId must match Employee branchId.', 'Approved contract'],
    ['Job title', 'Designation', 'Stable master', 'Company-scoped title; never grants permissions.', 'Role and designation verified independently.', 'Approved contract'],
    ['Worker record', 'Employee', 'Stable persona/master', 'One authoritative Company, Branch, Department, Designation and reporting manager.', 'Cross-branch same-Company manager allowed; cross-Company denied.', 'Applied and verified'],
    ['Login identity', 'User', 'Stable persona/master', 'Optional one-to-one Employee link; disabled and no-login states are deliberate.', 'Invitation acceptance and session creation are transactional test data.', 'Applied and verified'],
    ['Authorization', 'Role Assignment', 'Stable persona/master', 'Application permissions plus Company/Branch scope; never inferred from Designation.', 'All nine system roles plus three least-privilege roles exercised.', 'Applied and verified'],
    ['Counterparty', 'Business Party', 'Stable master', 'Company-scoped Customer or Vendor.', 'Two customers and one India vendor.', 'Approved contract'],
    ['Delivery work', 'Project', 'Stable + per-run', 'Company-owned; optional Branch/Customer; Employee project manager.', 'Baseline list/detail records and run-owned creation journeys.', 'Approved contract'],
    ['Legacy assignment', 'EmployeeCompanyAssignment', 'Excluded', 'Not canonical for MVP because active modules use Employee placement directly.', 'Record inconsistent owner-only usage as defect; do not seed.', 'Excluded'],
    ['Additional hierarchy', 'Teams, business units, cost centres, matrix managers', 'Excluded', 'Do not add a generic organization engine in this phase.', 'Scope guard in review and backlog.', 'Excluded'],
    ['Primary tenant', 'DSP Reference Group QA', 'Stable master', 'Contains India and UAE legal Companies.', 'Synthetic names/codes/emails visibly contain QA.', 'Approved contract'],
    ['Isolation tenant', 'DSP Isolation Group QA', 'Stable master', 'Minimal second tenant used only for cross-tenant denial.', 'No primary-tenant foreign key may resolve.', 'Approved contract'],
    ['Safe baseline adapters', '8 idempotent layers', 'Guarded seed', 'Shifts 4; workweek rows 42; finance 16; salary components 6; leave 23; workforce approvals 12; parties/projects 6; assets/licences 20.', `Final guarded rerun left all 188 organization/master records unchanged with zero drift; staging fingerprint ${STAGING_SCHEMA_SHA256}.`, 'Applied and verified'],
    ['Stable personas', '23 profiles', 'Guarded seed', '22 Users, 22 Employees, three custom roles, scoped assignments, reporting lines and one Department grant.', 'Final guarded apply synchronized 21 User records; immediate rerun left all 126 persona artifacts unchanged with zero drift.', 'Applied and verified'],
    ['Service-owned baseline', '11 explicit layers', 'Contract only', 'Entitlements, currencies, holidays, salary/tax, attendance/overtime, independent approvals, templates, secure files, project states, encrypted card and controlled files must use their owning services.', 'Each layer records a fail-closed reason; no direct Prisma shortcut is allowed.', 'Approved contract'],
    ['Mutable identifier', 'QA-<suite>-<UTC timestamp>-<nonce>', 'Per test run', 'Required in codes, email aliases and descriptions.', 'Run manifest records every created ID.', 'Approved contract'],
    ['Cleanup', 'Exact manifest IDs only', 'Per test run', 'Delete in dependency order; never broad-delete by prefix or date.', 'Schema guard, sentinel and confirmation token required.', 'Approved contract'],
    ['Recruitment', 'Candidate through joiner', 'Per test run', 'Application, interview, evaluation, offer, conversion, invitation and onboarding.', 'Clean signed offer plus required document mappings.', 'Not run'],
    ['Workforce', 'Attendance/leave/overtime/comp-off', 'Per test run', 'Requests, approvals, period transitions and conflicts are recreated each run.', 'Manager then HR where configured.', 'Not run'],
    ['Assets', 'Custody and licences', 'Per test run', 'Assignment, acknowledgement, transfer, return, waiver and allocation.', 'Independent sensitive waiver approval.', 'Not run'],
    ['Finance and payroll', 'Transactions/runs', 'Per test run', 'Maker/checker, reversal, payroll approval/payment/expense/payslip.', 'Maker and approver identities must differ.', 'Not run'],
    ['Files and delivery', 'Operations', 'Per test run', 'Upload, scan, receipt, retry, suppression and dead letter.', 'Provider-backed cases require sandbox services.', 'Not run'],
    ['Concurrency', 'Operation IDs and expected versions', 'Per test run', 'Exercise replay, stale version and double-submit behavior.', 'Deterministic assertions; no AI-only pass.', 'Not run'],
  ];
}

function organizationRows() {
  const rows = [];
  const add = (...values) => rows.push(values);
  add('Company', 'DSP Reference Group QA', 'DSP India Services Pvt Ltd QA', '', 'DSP-IN-QA', '', '', '', 'Legal entity', 'N/A', '', 'Stable contract', 'IN · INR · Asia/Kolkata · reporting year April–March; applied to dsp_pms_stg');
  add('Company', 'DSP Reference Group QA', 'DSP UAE Services LLC QA', '', 'DSP-AE-QA', '', '', '', 'Legal entity', 'N/A', '', 'Stable contract', 'AE · AED · Asia/Dubai · reporting year January–December; applied to dsp_pms_stg');
  add('Company', 'DSP Isolation Group QA', 'DSP Isolation Company QA', '', 'DSP-ISO-CO-QA', '', '', '', 'Legal entity', 'N/A', '', 'Stable contract', 'IN · INR · Asia/Kolkata · isolation-only baseline; applied to dsp_pms_stg');
  const departments = {
    'Kochi Headquarters': ['Administration', 'Human Resources', 'Finance', 'IT & Assets', 'Projects', 'Engineering'],
    'Bengaluru Delivery Centre': ['Administration', 'Projects', 'Engineering'],
    'Mumbai Client Services': ['Administration', 'Client Services', 'Finance'],
    'Dubai Headquarters': ['Administration', 'Human Resources', 'Finance', 'IT & Assets', 'Projects'],
    'Abu Dhabi Operations': ['Administration', 'Projects', 'Engineering'],
    'Isolation Branch': ['Human Resources', 'Engineering'],
  };
  for (const [branch, names] of Object.entries(departments)) {
    const isolation = branch === 'Isolation Branch';
    const uae = branch.startsWith('Dubai') || branch.startsWith('Abu Dhabi');
    const group = isolation ? 'DSP Isolation Group QA' : 'DSP Reference Group QA';
    const company = isolation
      ? 'DSP Isolation Company QA'
      : uae
        ? 'DSP UAE Services LLC QA'
        : 'DSP India Services Pvt Ltd QA';
    for (const name of names) {
      add('Department', group, company, `${branch} QA`, `${name} QA`, `${name} QA`, '', '', 'Branch', 'N/A', '', 'Stable contract', 'Branch-owned functional unit; applied to dsp_pms_stg');
    }
  }
  const personas = [
    ['Global', '', '', 'Platform Super Administrator', '', '', 'Super Administrator', 'Global', 'Yes', '', 'User identity without an Employee record'],
    ['India', 'Kochi Headquarters', 'Administration', 'India Organization Owner', 'Managing Director', '', 'Organization Owner', 'Company Group', 'Yes', '', 'Owns India/UAE switch'],
    ['India', 'Kochi Headquarters', 'Administration', 'India Company Administrator', 'Administration Executive', 'India Organization Owner', 'Company Administrator', 'Company', 'Yes', 'India Organization Owner', 'Company setup'],
    ['India', 'Kochi Headquarters', 'Human Resources', 'India HR Manager', 'HR Manager', 'India Organization Owner', 'HR Manager', 'Company', 'Yes', 'India Organization Owner', 'HR second approver'],
    ['India', 'Kochi Headquarters', 'Human Resources', 'India Recruiter', 'Recruiter', 'India HR Manager', 'HR Manager', 'Company', 'Yes', 'India HR Manager', 'Recruitment maker'],
    ['India', 'Kochi Headquarters', 'Human Resources', 'India Payroll Maker', 'Payroll Specialist', 'India HR Manager', 'Payroll Maker', 'Company', 'Yes', 'India HR Manager', 'Payroll maker only'],
    ['India', 'Kochi Headquarters', 'Engineering', 'India Engineering Manager', 'Engineering Manager', 'India Organization Owner', 'Employee', 'Company', 'Yes', 'India Organization Owner', 'Hiring/reporting manager'],
    ['India', 'Bengaluru Delivery Centre', 'Projects', 'India Project Manager', 'Project Manager', 'India Engineering Manager', 'Project Manager', 'Company', 'Yes', 'India Engineering Manager', 'Project/timesheet approval'],
    ['India', 'Kochi Headquarters', 'IT & Assets', 'India Asset Manager', 'IT and Asset Officer', 'India Organization Owner', 'Asset Manager', 'Company', 'Yes', 'India Organization Owner', 'Asset custody'],
    ['India', 'Bengaluru Delivery Centre', 'Engineering', 'India Asset Custodian', 'Software Engineer', 'India Project Manager', 'Asset Department Custodian', 'Department grant', 'Yes', 'India Project Manager', 'Explicit Engineering Department grant'],
    ['India', 'Mumbai Client Services', 'Finance', 'India Finance Maker', 'Finance Officer', 'India Organization Owner', 'Finance Maker', 'Company', 'Yes', 'India Organization Owner', 'Finance maker only'],
    ['India', 'Kochi Headquarters', 'Finance', 'India Independent Approver', 'Finance Officer', 'India Organization Owner', 'Finance Manager', 'Company', 'Yes', 'India Organization Owner', 'Finance/payroll checker'],
    ['India', 'Bengaluru Delivery Centre', 'Engineering', 'India General Employee', 'Software Engineer', 'India Engineering Manager', 'Employee', 'Branch', 'Yes', 'India Engineering Manager', 'Cross-branch manager case'],
    ['India', 'Mumbai Client Services', 'Client Services', 'India Read-only Auditor', 'Administration Executive', 'India Organization Owner', 'Read-only Auditor', 'Company', 'Yes', 'India Organization Owner', 'Read-only denial'],
    ['India', 'Kochi Headquarters', 'Engineering', 'India Disabled Employee', 'Software Engineer', 'India Engineering Manager', 'Employee', 'Branch', 'Disabled', 'India Engineering Manager', 'Disabled User and session-denial case'],
    ['India', 'Bengaluru Delivery Centre', 'Engineering', 'India Employee Without Login', 'Software Engineer', 'India Engineering Manager', '', 'None', 'No', 'India Engineering Manager', 'Employee-only record'],
    ['UAE', 'Dubai Headquarters', 'Human Resources', 'UAE Company Administrator and HR', 'HR Manager', '', 'Company Administrator + HR Manager', 'Company', 'Yes', '', 'UAE setup/HR'],
    ['UAE', 'Dubai Headquarters', 'Projects', 'UAE Reporting and Project Manager', 'Project Manager', 'UAE Company Administrator and HR', 'Project Manager', 'Company', 'Yes', 'UAE Company Administrator and HR', 'Cross-branch manager'],
    ['UAE', 'Dubai Headquarters', 'Finance', 'UAE Finance Maker', 'Finance Officer', 'UAE Company Administrator and HR', 'Finance Maker', 'Company', 'Yes', 'UAE Company Administrator and HR', 'AED maker'],
    ['UAE', 'Dubai Headquarters', 'Finance', 'UAE Independent Approver', 'Finance Officer', 'UAE Company Administrator and HR', 'Finance Manager', 'Company', 'Yes', 'UAE Company Administrator and HR', 'AED checker'],
    ['UAE', 'Abu Dhabi Operations', 'Engineering', 'UAE General Employee', 'Software Engineer', 'UAE Reporting and Project Manager', 'Employee', 'Branch', 'Yes', 'UAE Reporting and Project Manager', 'Abu Dhabi to Dubai reporting'],
    ['Isolation', 'Isolation Branch', 'Human Resources', 'Isolation HR Owner', 'HR Manager', '', 'Organization Owner + HR Manager', 'Company Group', 'Yes', '', 'Isolation actor'],
    ['Isolation', 'Isolation Branch', 'Engineering', 'Isolation Employee', 'Employee', 'Isolation HR Owner', 'Employee', 'Branch', 'Yes', 'Isolation HR Owner', 'Direct-ID denial target'],
    ['Run-owned', 'Bengaluru Delivery Centre', 'Engineering', 'Golden-thread Joiner', 'Software Engineer', 'India Engineering Manager', 'Employee', 'Branch', 'Created in E2E', 'India Engineering Manager', 'Candidate conversion output'],
  ];
  for (const row of personas) {
    const [country, branch, department, persona, designation, manager, role, scope, login, reporting, purpose] = row;
    const isolation = country === 'Isolation';
    const company = country === 'Global' ? '' : isolation ? 'DSP Isolation Company QA' : country === 'UAE' ? 'DSP UAE Services LLC QA' : 'DSP India Services Pvt Ltd QA';
    const group = country === 'Global' ? '' : isolation ? 'DSP Isolation Group QA' : 'DSP Reference Group QA';
    const qaBranch = branch ? `${branch} QA` : '';
    const qaDepartment = department ? `${department} QA` : '';
    add('Persona', group, company, qaBranch, persona, qaDepartment, designation, role, scope, login, reporting || manager, country === 'Run-owned' ? 'Per run' : 'Stable contract', country === 'Run-owned' ? `${purpose}; E2E not run` : `${purpose}; applied to dsp_pms_stg; credential secret excluded from evidence`);
  }
  return rows;
}

function navigationMapRows(routes) {
  const inventory = navigationInventory(routes);
  const descriptions = {
    Dashboard: 'Cross-module status and actions requiring attention.',
    'My Work': 'Employee-owned daily tasks, requests, projects and timesheets.',
    People: 'Employee lifecycle records and HR operations.',
    Recruitment: 'Opening through offer and employee conversion.',
    Workforce: 'Schedule, attendance, leave, overtime and comp-off.',
    Payroll: 'Monthly payroll preparation, review, payment and payslips.',
    Projects: 'Internal/client project delivery, tasks and approvals.',
    Finance: 'Financial setup, maker/checker transactions and reports.',
    'Assets & Licences': 'Asset custody, transfers, returns, waivers and licences.',
    Setup: 'Admin-only organization and module configuration.',
    Operations: 'Delivery/file recovery and exception queues.',
    Security: 'Users, roles, sessions and retention.',
  };
  return NAV_ORDER.map((section, index) => {
    const sectionRoutes = routes.filter((route) => route.section === section);
    return [
      index + 1,
      section,
      descriptions[section],
      sectionRoutes.length,
      sectionRoutes.slice(0, 4).map((route) => route.href).join(', '),
      section === 'Setup' || section === 'Operations' || section === 'Security' ? 'Admin/operations roles' : 'Permission and capability filtered',
      'One shared tree; maximum two interaction levels; existing URLs preserved.',
      `Implemented; ${inventory.total} configured routes (${inventory.auditable} auditable, ${inventory.planned} planned) structurally/unit verified; historical authenticated smoke: ${browserSmokeCountText()}; ${inventory.pendingAuthenticatedAudit} added route requires browser audit; menu-by-menu execution remains Not Run`,
    ];
  });
}

function environmentRows() {
  return [
    ['Database', 'DATABASE_NAME', 'dsp_erp_dev', 'dsp_erp_dev', 'Exact match before every writer', 'Live verified 2026-09-17', 'Do not infer from URL display name.'],
    ['Database', 'DATABASE_USER', 'dscape', 'dscape', 'Exact match before every writer', 'Live verified 2026-09-17', 'Same role increases schema-risk; compensating controls are active.'],
    ['Schema', 'Current schema', 'dsp_pms', 'Never a QA writer target', 'Hard refusal plus pre/post structure comparison', 'Passed', `Final read-only pg_dump comparison: CURRENT_SCHEMA_UNCHANGED; SHA-256 ${CURRENT_SCHEMA_SHA256}.`],
    ['Schema', 'Staging schema', 'dsp_pms_stg', 'Only accepted QA writer target', 'current_schema() + sentinel + token', 'Passed', `Structure baseline, sentinel and 161/161 migrations verified; 185 tables / 2,895 columns / 1,051 indexes; catalog fingerprint ${STAGING_SCHEMA_SHA256}.`],
    ['Schema', 'Cross-schema SQL', 'Six historical migrations contain schema-dependent or dynamic SQL', 'No schema control, explicit cross-schema reference or dynamic SQL in new migrations', '161-migration static audit plus exact name/checksum lineage', 'Passed for staging', '161/161 applied with zero missing, unexpected, duplicate, failed or checksum-mismatched migrations; historical from-zero chain remains a separate CI gate.'],
    ['Runtime', 'Node.js', 'Host 24.20.0; pnpm wrapper 22.17.0; bundled 24.19.0', '>=24.20.0 <25', 'package engines + typecheck/build', 'Qualified host runtime used for final verification', 'The stale pnpm shim remains an environment-cleanup item; final direct Node commands used 24.20.0.'],
    ['Runtime', 'pnpm', '11.24.0', '11.24.0', 'packageManager lock', 'Verified dependency', 'Use pnpm, not npm.'],
    ['Auth', 'AUTH_ACTION_TOKEN_SECRET_PATH', 'Missing in prior production validation', 'Mounted secret path', 'Environment validation', 'Open configuration gate', 'Never store secret material in workbook or repository.'],
    ['Public careers', 'Turnstile', 'Feature may be enabled without keys', 'Sandbox key pair before provider tests', 'Startup validation + negative test', 'Open configuration gate', 'Disabled or Sign in page is not Pass.'],
    ['Email', 'SMTP/sandbox', 'Assumed available', 'Real sandbox provider', 'Send, retry, bounce/suppression evidence', 'Not verified', 'Provider-backed tests remain blocked.'],
    ['Files', 'Object storage', 'Assumed available', 'Dedicated sandbox bucket/prefix', 'Upload/download/delete evidence', 'Not verified', 'Run-owned prefix only.'],
    ['Files', 'Malware scanner', 'Previously disabled', 'Scanner enabled with controlled test file', 'Clean/quarantine/retry evidence', 'Not verified', 'No production file access.'],
    ['Workers', 'Delivery/queue controls', 'Environment controlled', 'Infrastructure-only environment values', 'Health and retry evidence', 'Review required', 'Tenant allowlists move to Company entitlements.'],
    ['Tenant behavior', 'Country/currency/timezone/year/policies', 'Mixed environment and source defaults', 'Company/Branch/Financial Profile data', 'Readiness checks', 'Partially implemented', 'Company legal country, required Branch country/subdivision/timezone, reviewed working-week gate, Financial Profile offer currency and tax-country validation are implemented; broader policy convergence remains incomplete.'],
    ['Modules', 'Company entitlements', 'Environment allowlists', 'Explicit Company module entitlements with scoped administration', 'Two primary Companies enabled', 'Implemented; targeted browser smoke passed', 'Company entitlements replace active tenant allowlists. Owner manage, HR read-only and Employee denied states passed in the Company detail workflow; dependency controls were exercised without persisting a test change.'],
    ['Isolation', 'Schema fingerprint', 'Current structure baseline and staging catalog fingerprints captured', 'Before/after current-schema comparison', 'Recorded dump/hash and catalog manifests', 'Passed', `dsp_pms is byte-identical after excluding only pg_dump random guard tokens; SHA-256 ${CURRENT_SCHEMA_SHA256}.`],
    ['Seed', 'Idempotency', 'Organization, stable-master and persona baselines applied', 'Reference seed reruns have zero drift', 'Before/after manifest diff', 'Passed', 'Final organization/master rerun left 188 unchanged. The guarded persona apply synchronized 21 User records; its immediate rerun created 0, updated 0 and left 126 unchanged.'],
    ['Promotion', 'Current target checks', 'No promotion attempted', 'Restore point + dry-run + exact target confirmation', 'Migration/backfill evidence', 'Not run', 'Never copy QA people/files/transactions/settings.'],
  ];
}

function hardcodedRows() {
  return [
    ['HC-001', 'Employee creation', 'backend/src/modules/employee/employee.service.ts', 'Normal UI creation labelled LEGACY_IMPORT', 'MANUAL source', 'P1', 'Fixed; unit tested', '2026-09-17'],
    ['HC-002', 'Reporting hierarchy', 'backend/src/modules/employee/employee.service.ts', 'Manager forced to same Branch', 'Same Company, cross-Branch allowed', 'P1', 'Fixed; unit tested', '2026-09-17'],
    ['HC-003', 'Attendance regularization', 'frontend/features/attendance-exception/dialogs/submit-regularization-sheet.tsx', '09:00–18:00 and UAT-E2E reason prefilled', 'Explicit user-entered values', 'P1', 'Fixed; merged typecheck passed', '2026-09-17'],
    ['HC-004', 'Business calendar', 'frontend/features/business-calendar/*', '2026 and Asia/Kolkata defaults', 'Current year and explicit timezone', 'P1', 'Fixed; merged typecheck passed', '2026-09-17'],
    ['HC-005', 'Interview scheduling', 'frontend/features/recruitment/interviews/*', 'Asia/Kolkata-only default and limited list', 'Local IANA timezone plus India/UAE/UTC', 'P2', 'Fixed; merged typecheck passed', '2026-09-17'],
    ['HC-006', 'Recruitment mapper', 'frontend/features/recruitment/utils/api-mappers.ts', 'Missing timezone becomes Asia/Kolkata', 'Neutral UTC fallback; API must supply timezone', 'P2', 'Fixed; merged typecheck passed', '2026-09-17'],
    ['HC-007', 'Owner onboarding', 'backend/src/modules/organization-onboarding/organization-onboarding.service.ts', 'First Company/Department and name-matched Designation', 'Explicit selection', 'P1', 'Fixed; 11 backend and 7 frontend focused tests', '2026-09-17'],
    ['HC-008', 'Authentication defaults', 'backend/src/modules/auth', 'First role/company fallback', 'Explicit active/default assignment', 'P1', 'Fixed; ambiguous scopes require explicit selection; 29 focused tests', '2026-09-17'],
    ['HC-009', 'Government holidays', 'backend business-calendar provider', 'IN/AE 2026 fixture; empty otherwise', 'Controlled provider/import with review', 'P1', 'Fixed: reviewed packs fail closed; other scopes use controlled upload; 19 tests', '2026-09-17'],
    ['HC-010', 'Offer currency', 'recruitment offer UI/service', 'INR default', 'Company Financial Profile currency', 'P1', 'Fixed; 3 backend tests and merged frontend regression passed', '2026-09-17'],
    ['HC-011', 'Payroll country', 'payroll setup/UI', 'IN default', 'Company legal country', 'P1', 'Fixed: explicit Company legal-country source; UI derives it; tax profiles must match; focused tests passed', '2026-09-17'],
    ['HC-012', 'Module rollout', 'backend module gates and CompanyModuleEntitlement', 'Tenant allowlists with inconsistent empty semantics', 'Company module entitlements', 'P1', 'Fixed; migration applied and verified in staging; scoped Modules & Features administration implemented with focused tests', '2026-09-22'],
    ['HC-013', 'Version labels', 'backend/frontend active product labels and package targets', 'V1/V2/Lite/Legacy product terminology', 'Canonical unversioned product names', 'P2', 'Fixed for UI, environment and package targets; internal compatibility identifiers, immutable migrations and encrypted-data markers remain where contract safety requires them', '2026-09-18'],
    ['HC-014', 'Company settings', 'backend/src/modules/company-settings', 'Arbitrary mutable key/company/value without audit', 'Registered typed immutable keys, scope and audit', 'P1', 'Registry/audit foundation implemented for projects.week_start; broader settings migration open; 3 tests passed', '2026-09-17'],
    ['HC-015', 'Navigation', 'frontend/config/navigation.ts and app shell', 'Scattered menu and inaccessible tablet children', '12 task-first sections, two levels', 'P1', 'Fixed; 20 tests passed', '2026-09-17'],
    ['HC-016', 'Browser tests', 'frontend/e2e', 'Sign in/disabled pages accepted as Pass', 'Authenticated success assertions', 'P1', `Fixed in assertions and auth helper; smoke ${browserSmokeStatus().toLowerCase()}`, '2026-09-17'],
    ['HC-017', 'Branch localization', 'Branch DTO/form and organization setup', 'Country/subdivision/timezone optional; onboarding defaulted AE', 'Required ISO country/subdivision and IANA timezone; no tenant default', 'P1', 'Fixed; 8 focused validation tests', '2026-09-17'],
  ];
}

function menuWorkflowRows(routes) {
  return routes.map((route, index) => {
    const planned = route.availability === 'planned';
    const pendingAuthenticatedAudit =
      ROUTES_ADDED_AFTER_AUTHENTICATED_SMOKE.has(route.href);
    return [
      `MENU-${String(index + 1).padStart(3, '0')}`,
      route.section,
      route.title,
      route.href,
      route.access,
      route.capability,
      'Authenticated scoped persona; Company/Branch context selected when required.',
      `Open ${route.title}; verify list/detail or workspace actions permitted by role.`,
      'Required fields, foreign IDs, stale version, double submit and validation messages.',
      'Denied is explicit; no data leak; disabled/not configured is not Pass.',
      'Loading, empty, not configured, degraded, error, retry and conflict are distinct.',
      'Desktop + tablet + mobile',
      `E2E-MENU-${String(index + 1).padStart(3, '0')}`,
      `MAN-MENU-${String(index + 1).padStart(3, '0')}`,
      planned
        ? 'Planned/disabled; not audited'
        : pendingAuthenticatedAudit
          ? 'Added after browser evidence; authenticated audit pending'
          : 'Historical authenticated surface passed; full workflow Not Run',
      planned || pendingAuthenticatedAudit ? '' : browserSmokeEvidencePath(),
    ];
  });
}

function coverageRows(routes) {
  const inventory = navigationInventory(routes);
  return [
    ['AUTO-001', 'Backend unit', 'Employee manual source and cross-branch reporting manager', 'Jest', '2', 'Passed', 'Local 2026-09-17', 'Cross-company lookup remains scoped.'],
    ['AUTO-002', 'Backend unit', 'Typed Company Setting contract', 'Jest', '3', 'Passed', 'Local 2026-09-17', 'Normalizes weekday; rejects invalid/unknown keys.'],
    ['AUTO-003', 'Frontend unit', 'Navigation contract and capability states', 'Vitest', '8 current contract tests', 'Passed', 'frontend/config/navigation.test.ts; local 2026-09-22', `${inventory.total} unique URLs, 12 areas, two levels, zero planned routes and state handling.`],
    ['AUTO-004', 'Frontend static', 'Full frontend lint', 'ESLint', '4 errors; 10 warnings', 'Failed current retest', 'Local 2026-09-22', 'Failures are outside the Company Modules & Features change; all changed frontend files passed targeted lint. Release lint gate remains open.'],
    ['AUTO-005', 'Frontend static', 'Merged TypeScript application check', 'tsc', 'Application', 'Passed', 'Local 2026-09-22', 'Frontend typecheck passed under Node 24.20.0; the production build is recorded separately in AUTO-013.'],
    ['AUTO-006', 'Backend safety', 'Staging guard, migration lineage and reference/persona contract', 'Jest', '70 across 3 suites', 'Passed', 'Local/agent 2026-09-17', 'Includes dsp_pms refusal, sentinel/token, persona least privilege, exact contract counts and migration name/checksum validation.'],
    ['AUTO-007', 'Backend security', 'Onboarding authorization/idempotency/concurrency', 'Jest', '14 across 4 suites', 'Passed', 'Agent local 2026-09-17', 'Manager scope, atomic receipts, replay and compare-and-set transitions.'],
    ['AUTO-008', 'Backend regression', 'Full backend suite with guarded QA PostgreSQL access', 'Jest', '210 passed + 3 skipped suites; 1,220 passed + 17 skipped tests (1,237 total)', 'Passed with skips', 'Local 2026-09-22', 'Zero failures. Skipped suites/tests remain explicit and do not count as live golden-thread evidence.'],
    ['AUTO-009', 'Frontend regression', 'Full frontend suite', 'Vitest', '69/70 files; 181/182 tests', 'Failed current retest', 'Local 2026-09-22', 'One pre-existing HR-request workspace assertion finds two intentional New request actions. The 16 focused Company/navigation tests pass.'],
    ['AUTO-010', 'Database integration', 'Real PostgreSQL auth/concurrency', 'Jest/tsx', 'Critical modules', 'Not Run', '', 'Safe staging and login-capable personas exist, but live-mutation golden threads remain incomplete. Provider-backed file/email/scanner tests and business-owner manual sign-off are separate NO-GO gates.'],
    ['AUTO-011', 'Browser', 'Authenticated Playwright desktop/tablet/mobile smoke', 'Playwright', browserSmokeCountText(), browserSmokeStatus(), browserSmokeEvidencePath(), `${AUTHENTICATED_BROWSER_SMOKE_SCOPE} Current navigation contains ${inventory.total} routes; ${inventory.pendingAuthenticatedAudit} added route requires a fresh authenticated audit.`],
    ['AUTO-012', 'AI exploration', 'Targeted onboarding and schema-safety bypass exploration', 'AI + deterministic reproduction', '2 P1 findings', 'Fixed and retested', 'Local/agent 2026-09-17', 'Both findings received deterministic tests; full module-wise exploration remains Not Run.'],
    ['AUTO-013', 'Frontend build', 'Production Next.js build', 'Next.js/Turbopack', '99 pages', 'Passed', 'Local 2026-09-22', 'Compilation, TypeScript and static generation completed successfully under Node 24.20.0, including the Company Modules & Features route.'],
    ['AUTO-014', 'Package hygiene', 'Public package-script review and cleanup', 'Manifest/source/runbook audit', 'Backend 49 scripts; frontend 10 scripts', 'Passed', 'Post-merge local 2026-09-18', 'All retained write-capable backfill commands enforce the exact staging target, confirmation token and sentinel before mutation; active runbooks use current names.'],
    ['AUTO-015', 'Browser discovery', 'Playwright inventory and execution', 'Playwright', `${AUTHENTICATED_BROWSER_SMOKE.total} historical cases across 5 specs`, 'Current rerun required', browserSmokeEvidencePath(), `Desktop Chromium, 1024×768 touch tablet and mobile Chrome are configured. The historical route/control audit found 69 canonical routes. The current inventory has ${inventory.total}; Approval workflows is pending.`],
    ['AUTO-016', 'Backend gates', 'Prisma validation, production build and production TypeScript', 'Prisma/Nest/tsc', '3 commands', 'Passed', 'Local 2026-09-22', 'Prisma schema validation, Nest production build and application typecheck passed under Node 24.20.0.'],
    ['AUTO-017', 'Backend static', 'Production and test-source TypeScript', 'tsc', 'Application passed; tests failed with 3 errors', 'Partially passed', 'Local 2026-09-22', 'tsconfig.build.json passed. tsconfig.test.json retains three TS2698 spread errors in hr-request.service.spec.ts lines 168, 174 and 180.'],
    ['AUTO-018', 'Backend QA tooling', 'Migration audit, staging structure capture and current-schema comparison', 'tsx/pg_dump', '5 commands', 'Passed', `${FINAL_STAGING_AUDIT_EVIDENCE}; ${FINAL_CURRENT_SCHEMA_EVIDENCE}; ${FINAL_STAGING_STRUCTURE_EVIDENCE}`, `161 migrations scanned; staging lineage is 161/161 clean with 111 exact, 48 LF-equivalent and two CRLF-equivalent checksums; staging catalog fingerprint ${STAGING_SCHEMA_SHA256}; current structure is unchanged.`],
    ['AUTO-019', 'Backend static', 'Full backend lint', 'ESLint', '331 errors; 4 warnings', 'Failed current retest', 'Local 2026-09-22', 'Broad pre-existing formatting and unsafe-any debt remains outside this change; all changed Company API files passed targeted lint. Release lint gate remains open.'],
    ['AUTO-020', 'Backend unit', 'Company Financial Profile offer currency', 'Jest', '3', 'Passed', 'Local 2026-09-17', 'No INR fallback; missing profile and cross-currency request fail closed.'],
    ['AUTO-021', 'Backend/frontend unit', 'Founding-owner explicit organization selection', 'Jest/Vitest', '11 backend + 7 frontend', 'Passed', 'Local/agent 2026-09-17', 'No first-row inference; hierarchy, Branch location and stale/foreign links validated.'],
    ['AUTO-022', 'Backend/frontend unit', 'Authentication scope selection', 'Jest/Vitest', '27 backend + 2 frontend', 'Passed', 'Local/agent 2026-09-17', 'Single scope/default preserved; ambiguous scope requires user selection before session/invitation consumption.'],
    ['AUTO-023', 'Backend unit', 'Reviewed calendar packs and explicit effective year', 'Jest', '19 across 3 suites', 'Passed', 'Local/agent 2026-09-17', 'Unsupported geography/year fails closed with controlled-import guidance.'],
    ['AUTO-024', 'Backend/frontend unit', 'Company/Branch legal-location, offer currency and payroll country contracts', 'Jest/Vitest', '16 focused tests', 'Passed', 'Local 2026-09-17', 'Required country/subdivision/timezone, Company Financial Profile currency and Company-bound tax country.'],
    ['AUTO-025', 'Backend QA contract', 'Reference master-data and stable-persona plan', 'Jest/tsx', '19 master layers + 23 personas', 'Passed', 'Local/agent 2026-09-17', 'Contract v3: 22 Users, 22 Employees, three custom roles and one Department grant; the guarded live apply also passed.'],
    ['AUTO-026', 'Backend security', 'Canonical onboarding cancellation aliases', 'Jest', '12 across 2 suites', 'Passed', 'Local/agent 2026-09-17', 'DELETE and POST aliases share DTO, gate, capability, version, audit and receipt semantics.'],
    ['AUTO-027', 'Database seed', 'Guarded reference organization and stable-master apply/rerun', 'Prisma/tsx', '188 stable records', 'Passed', `${PERSONA_APPLY_EVIDENCE}; ${PERSONA_RERUN_EVIDENCE}`, `Final post-migration rerun created 0, updated 0, unchanged 188; staging fingerprint remained ${STAGING_SCHEMA_SHA256}.`],
    ['AUTO-028', 'Database safety', 'Current schema non-mutation and staging post-migration capture', 'pg_dump/tsx', '2 final evidence captures', 'Passed', `${FINAL_CURRENT_SCHEMA_EVIDENCE}; ${FINAL_STAGING_AUDIT_EVIDENCE}; ${FINAL_STAGING_STRUCTURE_EVIDENCE}`, `CURRENT_SCHEMA_UNCHANGED; dsp_pms SHA-256 ${CURRENT_SCHEMA_SHA256}. Staging audit is 161/161 clean with catalog fingerprint ${STAGING_SCHEMA_SHA256}; the clearance grant changed data only, so the prior final structure dump remains applicable.`],
    ['AUTO-029', 'Database seed', 'Guarded stable-persona apply and immediate rerun', 'Prisma/tsx', '126 persona artifacts', 'Passed', `${PERSONA_APPLY_EVIDENCE}; ${PERSONA_RERUN_EVIDENCE}`, 'Post-migration apply synchronized 21 User records. Immediate same-credential rerun created 0, updated 0, unchanged 126; zeroDataDriftOnRerun=true.'],
    ['AUTO-030', 'Auth/E2E safety', 'Credential rotation, exact session cleanup and same-origin refresh-cookie flow', 'tsx/Jest/Playwright helper', 'Guarded scripts + cookie regression', 'Implemented and verified', 'backend/scripts/qa/cleanup-reference-auth-sessions.ts; backend/test/foundation/auth.controller-cookie.spec.ts; frontend/e2e/helpers/auth.ts', 'Rotation is explicit and refuses active sessions. Cleanup targets exact contracted QA users/session IDs. Browser auth uses /api/auth and excludes secrets from evidence.'],
    ['AUTO-031', 'Browser controls', 'Canonical page, control and internal-link audit', 'Playwright + manual computer-use smoke', `Current ${inventory.total} canonical; historical 69 canonical / 68 audited / 1 planned / 73 links`, 'Historical pass; current rerun required', browserSmokeEvidencePath(), 'The historical run authenticated every then-available canonical page. Approval workflows was added later and remains pending. Visible enabled controls require accessible names; safe tabs, disclosures, menus and selectors are exercised without submitting data.'],
    ['AUTO-032', 'Backend/frontend/browser', 'Company Modules & Features administration', 'Jest/Vitest + manual computer-use smoke', '3 backend + 16 frontend focused tests; 3 authenticated personas', 'Passed', 'Local 2026-09-22', 'Covers complete entitlement projection, dependency rejection, atomic audited update, API boundary, dependency-safe toggles, read-only controls, Company route generation, removal of planned navigation routes, and Owner manage / HR read-only / Employee denied browser states. No browser-test change was saved.'],
  ];
}

function e2eRows() {
  const authenticatedSmoke = [
    'SMOKE-01',
    'Scoped reference personas',
    'Authenticated route and workspace smoke across five Playwright specs',
    `Sign in, disabled and not-configured pages never count as Pass. ${AUTHENTICATED_BROWSER_SMOKE_SCOPE}`,
    'Desktop + tablet + mobile',
    'Critical',
    browserSmokeRunIdentifier(),
    browserSmokeStatus(),
    'Automated',
    browserSmokeEvidencePath(),
  ];
  const threads = [
    ['GT-01', 'Founding owner', 'Registration → OTP → organization setup → invitations', 'Owner explicitly selects Company/Branch/Department/Designation; invitee accepts.', 'Desktop + mobile', 'Critical'],
    ['GT-02', 'Security admin', 'Users → roles → scopes → session revocation', 'Least privilege; disabled user and revoked session denied.', 'Desktop', 'Critical'],
    ['GT-03', 'Recruiter/manager/HR', 'Opening → application → screening → interview → decision → offer → Employee', 'Clean signed offer/doc mappings; new Employee/User created once.', 'Desktop + mobile', 'Critical'],
    ['GT-04', 'HR/manager/employee/IT/finance', 'Onboarding → asset allocation → active employee', 'Published template handoffs complete; licence capacity enforced.', 'Desktop + tablet', 'Critical'],
    ['GT-05', 'Workforce admin/employee', 'Calendar → roster → attendance → regularization → period close', 'Branch timezone/workweek used; closed period immutable.', 'Desktop + mobile', 'Critical'],
    ['GT-06', 'Employee/manager/HR', 'Leave + overtime + comp-off approvals', 'Manager then HR; balances and credits auditable.', 'Desktop + mobile', 'Critical'],
    ['GT-07', 'Project manager/employee', 'Client/internal Project → stage → task → worklog → timesheet approval', 'Company-scoped Business Party; configured week start.', 'Desktop + tablet', 'Critical'],
    ['GT-08', 'Finance maker/checker', 'Transaction → submit → independent approval → posting → reversal/report', 'Self-approval denied; attachment retained.', 'Desktop', 'Critical'],
    ['GT-09', 'Payroll maker/checker', 'Payroll → calculate → approve → pay → finance expense → payslip', 'Effective salary/tax required; maker differs from approver.', 'Desktop + mobile payslip', 'Critical'],
    ['GT-10', 'Operations', 'Delivery/file failure → retry/reconcile/recover', 'Suppression/dead-letter states explicit and audited.', 'Desktop', 'Critical'],
    ['GT-11', 'Group owner', 'India/UAE switching and country configuration', 'INR/AED, Kolkata/Dubai, Apr–Mar/Jan–Dec remain isolated.', 'Desktop + tablet', 'Critical'],
    ['GT-12', 'Primary/isolation actors', 'Cross-tenant direct-ID denial', '404/denial with no existence leak across every critical API.', 'API + desktop', 'Critical'],
    ['NEG-01', 'Any writer', 'Run writer with current_schema() = dsp_pms', 'Process refuses before mutation.', 'CLI', 'Critical'],
    ['NEG-02', 'Any writer', 'Wrong sentinel or confirmation token', 'Process refuses before mutation.', 'CLI', 'Critical'],
    ['NEG-03', 'Finance/Payroll maker', 'Self-approve own transaction/run', 'Denied and audited.', 'API + desktop', 'Critical'],
    ['NEG-04', 'Employee', 'Foreign Company/Branch/Department/manager IDs', 'Validation denies without leak.', 'API', 'High'],
    ['NEG-05', 'Any actor', 'Replay same operation ID', 'Same result/no duplicate side effect.', 'API', 'High'],
    ['NEG-06', 'Any actor', 'Submit stale expected version', 'Conflict state; reload/retry offered.', 'API + desktop', 'High'],
    ['NEG-07', 'File uploader', 'Oversize/MIME mismatch/scanner test', 'Reject/quarantine with safe message.', 'API + desktop', 'High'],
    ['NEG-08', 'Mobile/tablet user', 'Reach every permitted child menu', 'No desktop-only dead ends; switcher accessible.', 'Tablet + mobile', 'High'],
    ['MAN-01', 'Business owner', 'Terminology and task order walkthrough', 'No active V1/V2/Lite/Legacy product labels.', 'All viewports', 'High'],
    ['MAN-02', 'HR/Finance/Payroll owners', 'India golden-thread sign-off', 'Business outcome and control evidence accepted.', 'Desktop', 'Critical'],
    ['MAN-03', 'UAE owner', 'Targeted UAE setup/payroll/project/finance sign-off', 'No statutory-compliance claim.', 'Desktop', 'Critical'],
    ['MAN-04', 'QA lead', 'Empty/denied/not-configured/degraded/error/retry/conflict states', 'Each state is visually and semantically distinct.', 'All viewports', 'High'],
  ];
  return [
    authenticatedSmoke,
    ...threads.map((row) => [
      ...row,
      'QA-<suite>-<UTC timestamp>-<nonce>',
      'Not Run',
      '',
      '',
    ]),
  ];
}

function migrationRows() {
  return [
    ['MIG-001', 'Current schema protection', 'dsp_pms must never accept QA writers', 'Automated guard + sentinel + token', 'Passed', 'backend/test/foundation/qa-staging-safety.spec.ts', 'All writers targeted dsp_pms_stg; current structure remained byte-identical to the pre-operation dump.'],
    ['MIG-002', 'Staging target', 'dsp_erp_dev / dscape / dsp_pms_stg', 'Exact database/user/schema assertion', 'Passed', FINAL_STAGING_AUDIT_EVIDENCE, 'Final live target, permissions and sentinel audit passed read-only.'],
    ['MIG-003', 'Manual employee source', '20260917090000_employee_manual_creation_source', 'Schema-neutral enum extension', 'Implemented; Prisma validation passed', 'backend/prisma/migrations/20260917090000_employee_manual_creation_source/migration.sql', 'No explicit schema name.'],
    ['MIG-004', 'Historical migration scan', '161 migrations; six pinned schema-dependent/dynamic-SQL exceptions', 'Static audit plus exact applied-name/checksum lineage; separate ephemeral historical-chain validation', 'Staging passed; CI chain Not Run', 'backend/scripts/qa/lint-schema-neutral-migrations.ts', '161/161 staging ledger is clean; do not replay the six legacy exceptions directly into staging.'],
    ['MIG-005', 'Structure-only bootstrap', 'Current structure mirrored into dsp_pms_stg without tenant data', 'Reviewed transformed dump, atomic restore and catalog checks', 'Passed', FINAL_STAGING_STRUCTURE_EVIDENCE, `Final target: 185 tables, 2,895 columns, 1,051 indexes; catalog fingerprint ${STAGING_SCHEMA_SHA256}; final dump SHA-256 ${FINAL_STAGING_STRUCTURE_SHA256}; zero dsp_pms references.`],
    ['MIG-006', 'Reference seed', 'Organization foundation plus supported stable masters', 'Guarded idempotent seed + manifest', 'Passed for 188 records', PERSONA_APPLY_EVIDENCE, 'Final post-migration apply left 104 organization and 84 stable-master records unchanged. Personas were applied separately; service-owned workflow data remains intentionally command-owned.'],
    ['MIG-007', 'Seed rerun', 'Zero drift', 'Counts, keys and content fingerprint', 'Passed', PERSONA_RERUN_EVIDENCE, `Created 0, updated 0, unchanged 188; zeroDataDriftOnRerun=true; staging fingerprint remained ${STAGING_SCHEMA_SHA256}.`],
    ['MIG-008', 'Current fingerprint', 'dsp_pms before/after staging operations', 'Normalized structure-only pg_dump comparison', 'Passed', FINAL_CURRENT_SCHEMA_EVIDENCE, `CURRENT_SCHEMA_UNCHANGED; baseline and final SHA-256 both ${CURRENT_SCHEMA_SHA256}.`],
    ['MIG-009', 'Promotion dry-run', 'Current tenant configuration/backfills', 'Read-only readiness + backfill dry-run', 'Not Run', '', 'No QA data copied.'],
    ['MIG-010', 'Rollback', 'RDS restore point and rollback procedure', 'Recorded restore ID and rehearsal', 'Not Run', '', 'Release gate.'],
    ['MIG-011', 'Company legal country', '20260917100000_company_legal_country_code', 'Schema-neutral nullable column plus create-time validation and readiness enforcement', 'Applied to staging; Prisma validation passed', 'backend/prisma/migrations/20260917100000_company_legal_country_code/migration.sql', 'Existing current-schema Companies still require an explicit reviewed backfill before promotion.'],
    ['MIG-012', 'Migration lineage', 'All 161 repository migrations', 'Exact name plus raw/LF/CRLF checksum comparison', 'Passed', FINAL_STAGING_AUDIT_EVIDENCE, '111 exact, 48 LF-equivalent and two CRLF-equivalent; zero semantic checksum mismatches.'],
    ['MIG-013', 'Final staging structure', 'Post-migration dsp_pms_stg schema', 'Read-only canonical structure capture', 'Passed', FINAL_STAGING_STRUCTURE_EVIDENCE, `SHA-256 ${FINAL_STAGING_STRUCTURE_SHA256}; catalog fingerprint ${STAGING_SCHEMA_SHA256}; includes legal country and sentinel.`],
    ['MIG-014', 'Stable personas', '23 profiles / 22 Users / 22 Employees in dsp_pms_stg', 'Guarded apply plus immediate idempotent rerun', 'Passed', `${PERSONA_APPLY_EVIDENCE}; ${PERSONA_RERUN_EVIDENCE}`, 'Post-migration apply synchronized 21 User records; rerun created 0, updated 0, unchanged 126 with zero drift.'],
    ['MIG-015', 'Auth-session safety', 'Exact contracted QA users and active session IDs', 'Explicit credential rotation plus exact session cleanup', 'Implemented and verified', 'backend/scripts/qa/reference-persona-seeder.ts; backend/scripts/qa/cleanup-reference-auth-sessions.ts; scripts/qa/run-authenticated-smoke.ps1', 'Rotation refuses active sessions and requires an explicit flag. Cleanup never deletes by broad prefix and runner evidence never records the shared secret.'],
    ['MIG-016', 'Current migration readiness', 'dsp_pms current schema', 'Read-only migration-lineage comparison', 'Promotion pending', FINAL_STAGING_AUDIT_EVIDENCE, 'Current remains intentionally untouched. Its read-only ledger has 156 repository-matching entries of 161, with five tested migrations absent and zero unexpected, duplicate or checksum-mismatched entries; promotion requires the exact tested commit and reviewed backfills.'],
  ];
}

async function addSheets(workbook, routes) {
  const specs = [
    ['Reference Data Contract', 'Reference Data Contract', 'Canonical meanings, stable masters, run-owned data and cleanup rules', 'Approved implementation contract; synthetic QA data only.', ['Domain', 'Canonical entity/data', 'Data class', 'Rule', 'Validation / evidence', 'Status'], referenceDataRows(), [20, 28, 16, 48, 44, 18]],
    ['Organization and Persona Matrix', 'Organization and Persona Matrix', 'Production-shaped India/UAE reference organization plus isolation tenant', 'Organization masters and 23 stable persona profiles are applied to dsp_pms_stg. The immediate persona rerun left all 126 artifacts unchanged; one additional joiner remains per-run E2E data.', ['Record type', 'Company Group', 'Company', 'Branch', 'Name / Persona', 'Department', 'Designation', 'Role', 'Scope', 'Login', 'Reporting manager', 'Data class', 'Purpose / configuration'], organizationRows(), [14, 24, 28, 24, 28, 20, 22, 24, 16, 14, 24, 14, 44]],
    ['Navigation Map', 'Navigation Map', 'Task-first information architecture', 'One tree filtered by permissions/capabilities; two levels; existing URLs preserved.', ['Order', 'Area', 'Purpose', 'Route count', 'Representative routes', 'Audience', 'Standard', 'Implementation'], navigationMapRows(routes), [8, 22, 42, 12, 48, 26, 42, 28]],
    ['Environment & Dependency Audit', 'Environment and Dependency Audit', 'Deployment identity, services and schema isolation controls', 'Values are evidence requirements, not authorization to mutate a database.', ['Area', 'Setting / dependency', 'Observed / agreed', 'Required target', 'Validation', 'Status', 'Notes'], environmentRows(), [16, 28, 34, 38, 34, 24, 46]],
    ['Hardcoded Settings Register', 'Hardcoded Settings Register', 'Tenant-specific defaults and non-canonical product configuration', 'Migrations and encrypted format markers may retain immutable version labels.', ['ID', 'Area', 'Location', 'Current behavior', 'Target behavior', 'Severity', 'Implementation status', 'Target / evidence date'], hardcodedRows(), [11, 22, 48, 42, 42, 10, 26, 20]],
    ['Menu Workflow Matrix', 'Menu Workflow Matrix', 'Every active navigation route with validation and state expectations', `Generated from frontend/config/navigation.ts; ${routes.length} unique routes.`, ['ID', 'Area', 'Menu', 'Route', 'Permission(s)', 'Capability', 'Preconditions', 'Happy path', 'Validation / conflict', 'Denied / disabled', 'State handling', 'Viewports', 'E2E case', 'Manual case', 'Status', 'Evidence'], menuWorkflowRows(routes), [12, 20, 26, 36, 44, 18, 42, 46, 46, 40, 46, 22, 17, 17, 14, 28]],
    ['Existing Automated Coverage', 'Existing Automated Coverage', 'Current deterministic coverage and execution state', 'Pass counts are recorded only when the command completed successfully.', ['ID', 'Layer', 'Scope', 'Runner', 'Count', 'Status', 'Evidence', 'Notes'], coverageRows(routes), [12, 20, 46, 18, 16, 16, 28, 48]],
    ['E2E and Manual Cases', 'E2E and Manual Cases', 'Golden threads, negative controls and business sign-off', 'Skipped authentication, disabled modules and Sign in pages never count as Pass. Release remains NO-GO pending live-mutation golden threads, canonical Business Calendar publication, multi-Branch switching proof, provider-backed file/email/scanner tests and business-owner manual sign-off.', ['Case ID', 'Persona', 'Journey / scenario', 'Expected result', 'Viewport / layer', 'Priority', 'Run identifier', 'Status', 'Tester', 'Evidence'], e2eRows(), [12, 28, 52, 52, 22, 12, 34, 14, 18, 34]],
    ['Migration Evidence', 'Migration Evidence', 'Staging bootstrap, isolation, migration and promotion record', 'Executed staging evidence through 2026-09-22; the current dsp_pms structure remained unchanged.', ['ID', 'Control', 'Target / artifact', 'Evidence method', 'Status', 'Evidence location', 'Notes'], migrationRows(), [12, 28, 44, 38, 18, 34, 50]],
  ];

  for (const [name, title, subtitle, context, columns, rows, widths] of specs) {
    const sheet = workbook.worksheets.add(name);
    sheetTitle(sheet, title, subtitle, context, columns, rows, widths);
  }
}

async function appendDefects(workbook) {
  const sheet = workbook.worksheets.getItem('Defects and Retests');
  const table = sheet.tables.items[0];
  sheet.getRange('C6:O6').values = [[
    'Delivery rollout',
    'backend/src/modules/delivery/delivery-claim.service.ts',
    'Environment Company allowlists could enable or disable Delivery inconsistently.',
    'Implementation',
    'Merged working tree',
    'Post-change entitlement audit',
    'Fixed',
    'Backend/Product',
    'Working tree',
    'Company entitlement replacement',
    'Passed',
    '20260918130000_company_module_entitlements; delivery entitlement tests',
    'Resolved; provider-backed recovery testing remains a release gate',
  ]];
  sheet.getRange('C7:O7').values = [[
    'Designations and Onboarding',
    'frontend/features/onboarding-template/components/onboarding-template-toolbar.tsx',
    'Create Designation could be visible to Onboarding users without organization structure permission.',
    'Implementation',
    'Merged working tree',
    'Permission and route audit',
    'Fixed',
    'Frontend/Security',
    'Working tree',
    'Permission-gated action plus destination denial',
    'Passed',
    `frontend onboarding toolbar and route guards; ${browserSmokeEvidencePath()}`,
    'Live-mutation onboarding journey remains Not Run',
  ]];
  sheet.getRange('C8:O8').values = [[
    'Onboarding entitlement gate',
    'frontend and backend onboarding capability guards',
    'Onboarding controls and linking paths could bypass a disabled or restricted Company capability.',
    'Implementation',
    'Merged working tree',
    'Guard and route audit',
    'Fixed',
    'Backend/Frontend',
    'Working tree',
    'Entitlement containment suites plus authenticated route audit',
    'Passed',
    `backend/test/foundation/onboarding-entitlement-containment.spec.ts; ${browserSmokeEvidencePath()}`,
    'Live-mutation onboarding journey remains Not Run',
  ]];
  sheet.getRange('C9:O9').values = [[
    'Designations and Onboarding',
    'frontend use-create-designation.ts and backend designation.service.ts',
    'Designation creation and optional onboarding links could previously leave a partial result.',
    'Implementation',
    'Merged working tree',
    'Transactional source review and regression suite',
    'Fixed',
    'Backend/Frontend',
    'Working tree',
    'One create request and one database transaction',
    'Passed',
    'Designation create passes onboarding Department IDs into the transactional backend command; full regression passed',
    'Live-mutation onboarding journey remains Not Run',
  ]];
  sheet.getRange('C10:O10').values = [[
    'Designation Branch scope',
    'frontend/features/designation/forms/designation-form.tsx',
    'Onboarding Department choices could be ambiguous across Branches.',
    'Implementation',
    'Merged working tree',
    'Form and lookup source review',
    'Fixed',
    'Frontend/Product',
    'Working tree',
    'Explicit onboarding Branch and Branch-filtered Department lookup',
    'Passed',
    'Designation form requires a Branch before loading onboarding Departments and clears stale selections on Branch change',
    'Multi-Branch persona proof remains tracked separately',
  ]];
  sheet.getRange('C11:O11').values = [[
    'Onboarding navigation',
    'frontend navigation and onboarding workspaces',
    'Onboarding routes could be linked while omitted from the active navigation branch.',
    'Implementation',
    'Merged working tree',
    'Navigation contract and browser audit',
    'Fixed',
    'Frontend/Product',
    'Working tree',
    'Canonical navigation and route audit',
    'Passed',
    `frontend/config/navigation.test.ts; ${browserSmokeEvidencePath()}`,
    'Full onboarding journey remains Not Run',
  ]];
  sheet.getRange('C12:O12').values = [[
    'Payroll and Finance entitlements',
    'backend Company module-entitlement gates',
    'Environment Company allowlists could make Payroll and Finance availability inconsistent.',
    'Implementation',
    'Merged working tree',
    'Environment and entitlement audit',
    'Fixed',
    'Backend/Product',
    'Working tree',
    'Company entitlement replacement',
    'Passed',
    '20260918130000_company_module_entitlements; focused entitlement suites',
    'Live maker/checker journeys remain Not Run',
  ]];
  sheet.getRange('C13:O13').values = [[
    'Onboarding reminders',
    'backend onboarding reminder and task services',
    'Environment rollout lists could stop reminders even when a Company had the product capability.',
    'Implementation',
    'Merged working tree',
    'Entitlement containment audit',
    'Fixed',
    'Backend',
    'Working tree',
    'Company entitlement checks in reminder/task paths',
    'Passed',
    'backend/test/foundation/task-contribution-entitlement.spec.ts',
    'Provider-backed delivery recovery remains a release gate',
  ]];
  sheet.getRange('C14:O14').values = [[
    'File Storage entitlement evidence',
    'file-storage guards, operations and downloads',
    'Legacy empty-allowlist evidence could report false outcomes and miss late entitlement withdrawal.',
    'Implementation',
    'Merged working tree',
    'Deterministic entitlement tests',
    'Fixed',
    'Backend/Security',
    'Working tree',
    'Entry and immediately-before-operation entitlement checks',
    'Passed',
    'backend/test/foundation/file-storage-entitlement-recheck.spec.ts; file-download.service.spec.ts',
    'Provider-backed object storage and scanner tests remain a release gate',
  ]];
  table.rows.add(null, [
    ['RF-010', 'P0', 'Onboarding tasks', 'shared onboarding controllers/services', 'Body-controlled legacy routing can bypass task authorization.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend', 'Working tree', 'Focused onboarding security tests', 'Passed', '14 tests across 4 suites', 'Real PostgreSQL integration still required'],
    ['RF-011', 'P0', 'Onboarding idempotency', 'onboarding operation receipts', 'Receipt claimed outside the transaction can strand retries.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend', 'Working tree', 'Retry and atomic receipt tests', 'Passed', 'Included in 14 focused tests', 'Real PostgreSQL integration still required'],
    ['RF-012', 'P1', 'Onboarding concurrency', 'complete/cancel mutations', 'Stale reads permit conflicting complete/cancel writes.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend', 'Working tree', 'Compare-and-set transition tests', 'Passed', 'Included in 14 focused tests', 'Real PostgreSQL concurrency test still required'],
    ['RF-013', 'P1', 'Schema safety', 'backend/scripts/assert-destructive-db-guard.ts', 'Same database user/name allowed wrong-schema writes.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend', 'Working tree', 'Guard and contract tests', 'Passed', '62 tests across 2 QA suites', 'Live sentinel/fingerprint execution remains gated'],
    ['RF-014', 'P1', 'Owner onboarding', 'organization-onboarding.service.ts', 'First-row and name-matched organization placement.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend/Product', 'Working tree', 'Explicit owner-selection suites', 'Passed', '11 backend + 7 frontend tests', 'Authenticated browser retest remains'],
    ['RF-015', 'P1', 'Holiday import', 'business calendar provider', 'Fixed 2026 IN/AE fixture silently returns empty for other inputs.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend/Product', 'Working tree', 'Calendar provider/import/backfill suites', 'Passed', '19 tests', 'Provider-backed/manual review remains'],
    ['RF-016', 'P1', 'Navigation', 'frontend navigation/app shell', 'Tablet loses nested routes and switcher access.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Frontend', 'Working tree', 'Navigation contract tests plus authenticated multi-viewport smoke', 'Passed', `20 targeted tests; ${browserSmokeEvidencePath()}`, 'Branch switching remains separately unproven because no persona has more than one Branch scope.'],
    ['RF-017', 'P1', 'Playwright validity', 'frontend/e2e', 'Sign in and disabled states were accepted as successful workspace checks.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'QA/Frontend', 'Working tree', 'Authenticated Asset/Recruitment cases', browserSmokeStatus(), browserSmokeEvidencePath(), AUTHENTICATED_BROWSER_SMOKE_SCOPE],
    ['RF-018', 'P1', 'Company settings', 'backend/src/modules/company-settings', 'Arbitrary key/value, mutable ownership and no scope/audit.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend', 'Working tree', 'Company setting contract tests', 'Passed', '3 targeted tests', 'Service integration test still required'],
    ['RF-019', 'P2', 'Employee workflow', 'backend/src/modules/employee/employee.service.ts', 'Manual creation labelled legacy and manager restricted to same Branch.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend', 'Working tree', 'Employee organization rule tests', 'Passed', '2 targeted tests', 'DB integration test still required'],
    ['RF-020', 'P2', 'Runtime/toolchain', 'pnpm wrapper', 'The PATH pnpm shim invokes Node 22.17.0 while packages require >=24.20.0 <25.', 'Environment', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Command evidence', 'Open', 'Infrastructure', '', 'Repair the shared pnpm shim', 'Not Run', 'Final gates used host Node 24.20.0 directly', 'Developer-environment cleanup; qualified evidence is available'],
    ['RF-021', 'P1', 'Reference seed', 'backend/scripts/qa/seed-reference-data.ts', 'Stable persona provisioning was missing from the guarded reference seeder.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend/QA', 'Working tree', 'Guarded persona apply and rerun', 'Passed', `${PERSONA_APPLY_EVIDENCE}; ${PERSONA_RERUN_EVIDENCE}`, 'Applied to dsp_pms_stg; immediate rerun left all 126 persona artifacts unchanged.'],
    ['RF-022', 'P1', 'Product configuration', 'backend Company module-entitlement gates and active product labels', 'Environment allowlists and versioned product terminology could make Company behavior inconsistent.', 'Implementation', 'Merged working tree', 'Post-change environment, route and terminology audit', 'Fixed', 'Backend/Product', 'Working tree', 'Company entitlements and canonical terminology', 'Passed', '20260918130000_company_module_entitlements; package target and environment audits', 'Company entitlements supersede active tenant allowlists. UI, environment and package targets are canonical; internal compatibility identifiers and immutable data markers remain where contract safety requires them.'],
    ['RF-023', 'P1', 'Authentication scope', 'backend/src/modules/auth', 'Ambiguous users could inherit the first role/company assignment.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend/Frontend', 'Working tree', 'Auth scope suites plus authenticated browser smoke', 'Passed', `27 backend + 2 frontend tests; ${browserSmokeEvidencePath()}`, 'Explicit Company switching passed for the group owner; multi-Branch switching remains a coverage gap.'],
    ['RF-024', 'P1', 'Branch localization', 'Branch DTO/form/onboarding', 'Country, subdivision and timezone were optional and onboarding defaulted UAE.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend/Frontend', 'Working tree', 'Branch contract tests', 'Passed', '8 tests', 'Existing Branch readiness/backfill required'],
    ['RF-025', 'P1', 'Company financial/legal configuration', 'offers and payroll tax profiles', 'INR/IN defaults could leak into UAE workflows.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Source review', 'Fixed', 'Backend/Frontend', 'Working tree', 'Currency/country contract tests', 'Passed', 'Focused tests passed', 'Existing Company backfill required'],
    ['RF-026', 'P1', 'Onboarding cancellation', 'employee-onboarding.controller.ts', 'Legacy DELETE bypassed the canonical gate, capability, expected-version, audit and receipt contract.', 'AI-assisted review', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Deterministic source reproduction', 'Fixed', 'Backend', 'Working tree', 'Canonical routing and command-safety suites', 'Passed', '12 tests across 2 suites', 'Real PostgreSQL race validation remains'],
    ['RF-027', 'P1', 'Migration schema neutrality', 'backend/scripts/qa/schema-neutral-sql.ts', 'search_path and dynamically executed SQL could evade the qualified-name-only migration scan.', 'AI-assisted review', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Deterministic parser reproduction', 'Fixed', 'Backend/QA', 'Working tree', 'Schema-control and dynamic-SQL rejection tests', 'Passed', 'Focused connection-free tests', 'Ephemeral historical-chain validation remains'],
    ['RF-028', 'P1', 'Migration lineage', '20260821181000_office_finance_payroll_release_contract', 'An already-applied migration had been edited to add NOT VALID, so repository SQL no longer matched the applied ledger.', 'Implementation', 'PMS-170926 canonical file; local master backport 4ca5abd', 'Read-only ledger audit', 'Fixed', 'Backend/DBA', 'Local backport branch', '156-name/checksum master-lineage audit', 'Passed', '156 repository migrations match 156 applied current migrations with zero semantic mismatches', 'Backport remains local until reviewed and pushed'],
    ['RF-029', 'P1', 'Staging readiness', 'backend/scripts/qa/audit-staging-readiness.ts', 'The audit checked migration counts but not exact names or checksums and could report a false ready state.', 'Implementation', 'PMS-170926 working tree', 'AI-assisted risk audit', 'Fixed', 'Backend/QA', 'Working tree', 'Migration lineage unit/live audit', 'Passed', 'Three deterministic lineage tests plus live 161/161 staging audit', 'Historical from-zero chain remains a separate CI gate'],
    ['RF-030', 'P1', 'Playwright authentication', 'frontend/e2e/helpers/auth.ts', 'The helper authenticated directly against backend /auth and bypassed the product /api proxy, so the /api/auth refresh cookie was unavailable to the app.', 'Implementation', '687a9c81e0b0e245213233502b88c89bca24b3d1', 'Deterministic browser/log reproduction', 'Fixed', 'QA/Frontend', 'Working tree', 'Same-origin login/refresh/logout plus cookie regression', 'Passed', `backend/test/foundation/auth.controller-cookie.spec.ts${browserSmokeEvidencePath() ? `; ${browserSmokeEvidencePath()}` : ''}`, 'Backend cookie Path remains /api/auth. Browser smoke outcome is recorded separately and does not imply golden-thread completion.'],
    ['RF-031', 'P1', 'Designation lifecycle', 'frontend/features/designation/forms/designation-form.tsx', 'Deactivating a Designation could clear existing onboarding departments.', 'Implementation', 'Merged working tree', 'Post-merge deterministic regression', 'Fixed', 'Frontend', 'Working tree', 'Designation deactivation preserves onboarding links', 'Passed', 'frontend/features/designation/forms/designation-form.test.tsx', 'Live-mutation onboarding golden thread remains Not Run.'],
    ['RF-032', 'P0', 'Shared onboarding templates', 'backend/src/modules/designation/designation.service.ts', 'Clearing one Designation could delete a checklist still owned through a sibling Designation, assignment or template scope.', 'Implementation', 'Merged working tree', 'Post-merge deterministic regression', 'Fixed', 'Backend', 'Working tree', 'Shared-template ownership guard rejects destructive cleanup', 'Passed', 'backend/test/foundation/designation-onboarding-sync-ownership.service.spec.ts', 'Live-mutation onboarding golden thread remains Not Run.'],
    ['RF-033', 'P1', 'Navigation permissions', 'frontend/config/navigation.ts', 'Shifts and Apply Leave visibility or route access could disagree with the granted permission set.', 'Implementation', 'Merged working tree', 'Post-merge deterministic regression', 'Fixed', 'Frontend', 'Working tree', 'Shifts and Apply Leave permission-contract retest', 'Passed', `frontend/config/navigation.test.ts; ${browserSmokeEvidencePath()}`, 'Authenticated route surfaces passed; full approval journeys remain Not Run.'],
    ['RF-034', 'P1', 'Calendar import identity', 'frontend/features/business-calendar/imports-workspace.tsx', 'An import could retain stale Company or version IDs after its context changed.', 'Implementation', 'Merged working tree', 'Post-merge deterministic regression', 'Fixed', 'Frontend', 'Working tree', 'Current scoped Company/version ID import retest', 'Passed', 'frontend/features/business-calendar/selection-scope.test.ts', 'Provider-backed file/email/scanner testing remains a separate release gate.'],
    ['RF-035', 'P1', 'Separation assets', 'frontend/features/hr-operations/lib/asset-resolution-links.ts', 'Separation asset links could be shown without caller-specific permission filtering.', 'Implementation', 'Merged working tree', 'Post-merge deterministic regression', 'Fixed', 'Frontend', 'Working tree', 'Permission-filtered separation asset-link retest', 'Passed', 'frontend/features/hr-operations/lib/asset-resolution-links.test.ts', 'Live-mutation separation golden thread remains Not Run.'],
    ['RF-036', 'P1', 'Browser smoke runner', 'scripts/qa/run-authenticated-smoke.ps1', 'localhost and 127.0.0.1 loopback origins could diverge, breaking runner startup or session continuity.', 'Implementation', 'Merged working tree', 'Deterministic runner-harness regression', 'Fixed', 'QA/Frontend', 'Working tree', 'Normalized loopback-origin runner retest', 'Passed', browserSmokeEvidencePath(), '59 passed, 0 failed and 3 deliberate live-mutation skips across 62 cases.'],
    ['RF-037', 'P1', 'Page-control audit', 'frontend/e2e/page-control-audit.spec.ts', 'The page-control audit could run before auth refresh settled and report an unauthenticated control state.', 'Implementation', 'Merged working tree', 'Deterministic harness regression', 'Fixed', 'QA/Frontend', 'Working tree', 'Auth-refresh-aware page-control harness retest', 'Passed for historical inventory', browserSmokeEvidencePath(), 'The 2026-09-18 run covered 69 canonical routes: 68 audited, 0 unavailable, one planned/disabled; 73 unique internal links. The current 69-route composition replaces Settings with Approval workflows and requires a rerun.'],
    ['RF-038', 'P1', 'Authentication degraded mode', 'backend/src/modules/auth/session.service.ts', 'With Redis disabled, six concurrent requests for one authenticated page could exceed the global PostgreSQL fallback limit and return HTTP 503.', 'Implementation', 'Merged working tree', 'Authenticated browser reproduction plus deterministic concurrency tests', 'Fixed', 'Backend/Security', 'Working tree', 'Same-session fallback coalescing and distinct-session overload retest', 'Passed', `backend/test/foundation/session-rotation.spec.ts; ${browserSmokeEvidencePath()}`, 'Final authenticated browser rerun completed with zero HTTP 503 failures.'],
    ['RF-039', 'P2', 'Form accessibility', 'Recruitment interview and leave-balance filters', 'Date/year, Company, Branch, job-opening, status and employee-search filters lacked reliable accessible names.', 'Implementation', 'Merged working tree', 'Page-control audit plus component tests', 'Fixed', 'Frontend', 'Working tree', 'Label association regression', 'Passed', 'frontend/features/recruitment/interviews/components/interview-workspace.test.tsx; frontend/features/leave-balance/components/employee-leave-balance-workspace.test.tsx; frontend/features/leave-balance/dialogs/generate-leave-balances-sheet.test.tsx', 'Final control audit found no unnamed visible enabled controls.'],
    ['RF-040', 'P2', 'Page-control audit stability', 'frontend/e2e/page-control-audit.spec.ts', 'A data-driven combobox could rerender between enumeration and activation, producing a detached-handle false positive.', 'Implementation', 'Merged working tree', 'Deterministic locator review and focused lint', 'Fixed', 'QA/Frontend', 'Working tree', 'Live accessible-role/name re-resolution before safe activation', 'Passed for historical inventory', browserSmokeEvidencePath(), 'The 2026-09-18 69-route audit passed; the current 69-route composition requires a rerun.'],
    ['RF-041', 'P0', 'Database script safety', 'backend/package.json and retained migration/backfill scripts', 'Seven retained write-capable commands could target whichever schema the environment selected without the exact staging sentinel guard.', 'Implementation', 'Merged working tree', 'Manifest/source audit plus staging-safety suite', 'Fixed', 'Backend/QA', 'Working tree', 'Exact target, confirmation token and sentinel required immediately before mutation', 'Passed', 'backend/test/foundation/qa-staging-safety.spec.ts', 'Current-schema promotion requires a separately reviewed current-target path; these QA commands fail closed on dsp_pms.'],
    ['RF-042', 'P2', 'Document retention controls', 'frontend/app/(dashboard)/settings/security/document-retention/page.tsx', 'Repeated Rule, Value, Enabled, Save and Approve controls were not distinguishable by policy to assistive technology or automation.', 'Implementation', 'Merged working tree', 'Manual browser reproduction plus component tests', 'Fixed', 'Frontend/Security', 'Working tree', 'Policy-specific labels and action names', 'Passed', `frontend/app/(dashboard)/settings/security/document-retention/page.test.tsx; ${browserSmokeEvidencePath()}`, 'All five policy rows expose distinct contextual control names.'],
    ['RF-043', 'P1', 'Critical workflow controls', 'Finance, Projects, Assets, Calendar, Employee and Security forms', 'Visible filters, selectors, row actions and form fields could be ambiguous or unnamed, making workflows difficult to understand and audit.', 'Implementation', 'Merged working tree', 'Manual browser reproduction, focused tests and full page audit', 'Fixed', 'Frontend', 'Working tree', 'Accessible names, label associations and contextual action names', 'Passed', `63 Vitest files / 163 tests; ${browserSmokeEvidencePath()}`, 'Manual computer-use smoke verified representative create forms without submitting data.'],
    ['RF-044', 'P1', 'Finance pagination', 'backend/src/modules/office-finance/dto/finance-transaction.dto.ts', 'Page and limit query strings reached Prisma unchanged, causing a 400 with take set to a string on the Transactions page.', 'Implementation', 'Merged working tree', 'Authenticated browser reproduction plus DTO tests', 'Fixed', 'Backend/Finance', 'Working tree', 'Transform and validate numeric pagination before Prisma', 'Passed', `backend DTO tests; ${browserSmokeEvidencePath()}`, 'Finance Transactions now loads and its create dialog was manually inspected and cancelled without mutation.'],
    ['RF-045', 'P2', 'Package script terminology', 'backend/package.json and backend/scripts', 'Twelve retained package targets still exposed versioned filenames after public script-key cleanup.', 'Implementation', 'Merged working tree', 'Manifest/source audit', 'Fixed', 'Backend/QA', 'Working tree', 'Canonical asset, delivery and projects filenames', 'Passed', 'backend/package.json; package target audit', 'Active package targets use canonical names; internal compatibility identifiers and immutable migration/encrypted-data markers are intentionally retained.'],
    ['RF-046', 'P1', 'Canonical Business Calendar baseline', 'backend/scripts/qa/reference-master-data-seeder.ts and Business Calendar UI', 'The seed creates legacy Branch working-day rows, but no canonical Company/Branch BusinessCalendar exists; the authenticated page reports No company calendar yet.', 'Reference-data gap', 'Merged working tree', 'Authenticated browser reproduction', 'Open', 'Backend/Product/QA', '', 'Create and publish calendars through the command-owned review workflow', 'Not Run', browserSmokeEvidencePath(), 'Blocks Calendar→roster→attendance golden-thread sign-off; direct Prisma publication remains forbidden.'],
    ['RF-047', 'P1', 'Multi-Branch switching coverage', 'reference persona role assignments', 'The group owner can switch India/UAE Companies, but no reference login has two permitted Branches in one Company, so Branch switching cannot be proven.', 'Coverage gap', 'Merged working tree', 'Authenticated browser review', 'Open', 'QA/Product', '', 'Add a bounded multi-Branch scoped persona or reviewed role assignment', 'Not Run', browserSmokeEvidencePath(), 'Company switching passed; ordinary single-Branch restrictions remain intentional.'],
    ['RF-048', 'P1', 'File download entitlements', 'backend/src/modules/file-storage/services/file-download.service.ts', 'Project documents, Finance attachments and payslips could reach presign logic without consistently rechecking the Company File Storage entitlement.', 'Security review', 'Merged working tree', 'Deterministic service tests', 'Fixed', 'Backend/Security', 'Working tree', 'Entry and immediately-before-presign entitlement checks', 'Passed', 'backend/src/modules/file-storage/services/file-download.service.spec.ts; 6 tests', 'Provider-backed object-storage and malware-scanner validation remains a release gate.'],
    ['RF-049', 'P1', 'Finance report Branch scope', 'backend/src/modules/office-finance/services/office-finance-reports.service.ts', 'A Branch-scoped user could supply another valid Branch UUID in a report query and override the active Branch filter.', 'Security review', 'Merged working tree', 'Hostile valid-UUID scope tests', 'Fixed', 'Backend/Finance', 'Working tree', 'Branch-scoped reports always enforce the active Branch; Company-wide users retain filtering', 'Passed', 'backend/src/modules/office-finance/services/office-finance-branch-scope.spec.ts; 6 tests', 'Live maker/checker and report reconciliation remain Not Run.'],
    ['RF-050', 'P1', 'Staging schema guard', 'backend/scripts/assert-destructive-db-guard.ts', 'PostgreSQL name[] decoding returned current_schemas(false) as a string and could falsely block a valid staging-only search path.', 'Implementation', 'Merged working tree', 'Guarded staging migration reproduction', 'Fixed', 'Backend/QA', 'Working tree', 'Serialize current_schemas(false) as JSON before validation', 'Passed', 'backend/test/foundation/qa-staging-safety.spec.ts; 46 tests', 'The guard still fails closed for dsp_pms, wrong target, sentinel or confirmation token.'],
    ['RF-051', 'P2', 'QA Git executable portability', 'backend/scripts/qa/seed-reference-data.ts and create-qa-run-manifest.ts', 'QA evidence scripts assumed git was directly available on PATH and failed on the Windows workstation layout.', 'Implementation', 'Merged working tree', 'Guarded reference-seed rerun', 'Fixed', 'Backend/QA', 'Working tree', 'Resolve GIT_BIN or the standard Windows Git executable before falling back to git', 'Passed', `${PERSONA_APPLY_EVIDENCE}; ${PERSONA_RERUN_EVIDENCE}`, 'No secret or tenant data is written to evidence.'],
    ['RF-052', 'P1', 'Reused frontend origin', 'scripts/qa/run-authenticated-smoke.ps1', 'Using 127.0.0.1 for a reused localhost Next.js development server caused cross-origin chunk blocking and inactive controls.', 'Implementation', 'Merged working tree', 'Authenticated Playwright rerun', 'Fixed', 'QA/Frontend', 'Working tree', 'Reuse the exact localhost origin and terminate only runner-owned process trees', 'Passed', browserSmokeEvidencePath(), 'Existing user-owned frontend processes are never terminated by reuse mode.'],
    ['RF-053', 'P2', 'Navigation placeholder', 'frontend/config/navigation.ts', 'The hidden /settings item counted as a route even though no page or workflow existed.', 'Implementation', 'PMS-170926 working tree', 'Navigation contract review', 'Fixed', 'Frontend/Product', 'Working tree', 'Remove the dead placeholder and require zero planned routes', 'Passed', 'frontend/config/navigation.test.ts; 8 tests', 'The implemented document-retention route remains under Security.'],
    ['RF-054', 'P1', 'Company module administration', 'Company module entitlement API and Company detail page', 'Company entitlements existed in the database and runtime gates but administrators had no supported workflow to review or change them.', 'Implementation', 'PMS-170926 working tree', 'TDD service/component validation plus authenticated browser smoke', 'Fixed', 'Backend/Frontend/Product', 'Working tree', 'Scoped read/manage API, dependency rules, atomic audit and accessible controls', 'Passed', '3 backend + 16 frontend focused tests; Owner, HR and Employee browser evidence', 'Owner manage, HR read-only and Employee denied states passed; dependency behavior was exercised without saving a staging change.'],
  ]);
}

function updateOverview(workbook, routes) {
  const inventory = navigationInventory(routes);
  const sheet = workbook.worksheets.getItem('Overview');
  sheet.getRange('A2').values = [[
    'Workflow hardening, guarded staging-schema validation, reference-data contract and evidence-led release readiness',
  ]];
  sheet.getRange('A3').values = [[
    `Regenerated 2026-09-22. Current navigation: ${inventory.total} routes; ${inventory.auditable} auditable; ${inventory.planned} planned. Historical smoke: ${browserSmokeCountText()}; it predates Approval workflows. Company Modules & Features passed a targeted three-persona browser smoke; Approval workflows and the complete current route inventory still require a fresh audit. Release remains NO-GO until the remaining gates pass.`,
  ]];
  sheet.getRange('B6').values = [['NO-GO']];
  sheet.getRange('B10').values = [[3]];
  sheet.getRange('A11').values = [['Golden-thread/manual cases Not Run']];
  sheet.getRange('B11').values = [[24]];
  sheet.getRange('A13').values = [['Baseline and working state']];
  sheet.getRange('B13').values = [[
    'Baseline 687a9c81e0b0e245213233502b88c89bca24b3d1 plus reviewed uncommitted implementation; no frozen release SHA',
  ]];
  sheet.getRange('D6:H6').values = [[
    'Testing target',
    'Shared dsp_erp_dev; guarded dsp_pms_stg schema',
    'Uses current infrastructure while refusing dsp_pms and isolating all synthetic QA data',
    `Staging verified; browser surface checks incomplete; release remains NO-GO`,
    'Release Owner',
  ]];
  sheet.getRange('D7:H11').values = [[
    'Company modules',
    'Canonical baseline entitlements for every Company',
    'Eliminates tenant UUID allowlists and inconsistent empty-list behavior',
    'Implemented and verified in staging',
    'Product Owner',
  ], [
    'Delivery',
    'Company entitlement plus provider readiness',
    'Uses one canonical workflow without active version labels',
    'Implemented; provider-backed recovery tests pending',
    'Delivery Owner',
  ], [
    'Existing forms',
    'Retain the UI and clarify controls, validation and workflow states',
    'Prioritizes usable end-to-end workflow over visual redesign',
    'Non-mutating surfaces verified; live journeys pending',
    'Product Owner',
  ], [
    'Small actions',
    'Dialogs for confirmations, approvals, assignments and remarks',
    'Keeps short actions concise while preserving clear validation',
    'Representative controls verified',
    'UX Owner',
  ], [
    'Evidence',
    'Automation, browser checks and business validation tracked separately',
    'A visible page or skipped journey never counts as workflow completion',
    'Release remains NO-GO until the open gates pass',
    'QA Lead',
  ]];
  sheet.getRange('A15').values = [[
    'Historical 2026-09-09 work breakdown below — superseded by the 2026-09-17 contract, workflow, evidence and migration sheets.',
  ]];
  sheet.getRange('A15').format.font = {
    name: 'Arial',
    size: 9,
    bold: true,
    color: '#9C5700',
  };
}

function markInheritedBaseline(workbook) {
  const inherited = [
    'Master Tasks',
    'Module Flows',
    'Production Settings',
    'Persona UAT',
    'Sources and Controls',
    'Documentation',
  ];
  for (const name of inherited) {
    const sheet = workbook.worksheets.getItem(name);
    sheet.getRange('A1').values = [[
      `Historical baseline — ${name} (2026-09-09; superseded)`,
    ]];
    sheet.getRange('A3').values = [[
      'Retained for traceability only. Do not execute legacy UAT, V1/V2/Lite/Legacy, environment-allowlist, or isolated-database instructions from this sheet; use the 2026-09-17 sheets and staging-safety runbook.',
    ]];
    sheet.getRange('A3').format.fill = '#FFF4CE';
    sheet.getRange('A3').format.font = {
      name: 'Arial',
      size: 9,
      bold: true,
      color: '#9C5700',
    };
  }

  const gates = workbook.worksheets.getItem('Release Gates');
  gates.getRange('A2').values = [[
    'Production GO requirements for one frozen SHA and approved release controls',
  ]];
  gates.getRange('C7:E7').values = [[
    'Guarded staging-schema topology',
    'Shared dsp_erp_dev database; QA writers only to dsp_pms_stg; dsp_pms is refused; synthetic primary and isolation tenants only',
    'Sentinel/token/fingerprint and reviewed topology evidence',
  ]];
  gates.getRange('G7').values = [['Passed']];
  gates.getRange('C10:E11').values = [[
    'Company module entitlements',
    'Every Company receives the canonical module baseline; permissions and provider readiness control use',
    'Company entitlement and capability matrix',
  ], [
    'Canonical Delivery readiness',
    'Delivery is Company-entitled by default; provider credentials, retries and recovery must pass before live sending',
    'Provider claim, retry and recovery evidence',
  ]];
}

async function verifyWorkbook(workbook) {
  const errors = [];
  for (const sheet of workbook.worksheets.items) {
    const used = sheet.getUsedRange(true);
    if (!used) continue;
    const values = used.values;
    for (let row = 0; row < values.length; row += 1) {
      for (let column = 0; column < values[row].length; column += 1) {
        const value = values[row][column];
        if (
          typeof value === 'string' &&
          /#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)/.test(value)
        ) {
          errors.push(`${sheet.name}!${columnName(column + 1)}${row + 1}: ${value}`);
        }
      }
    }
  }
  if (errors.length) {
    throw new Error(`Formula/value errors detected:\n${errors.join('\n')}`);
  }
  const summary = await workbook.inspect({
    kind: 'workbook,sheet,table',
    maxChars: 40000,
    tableMaxRows: 3,
    tableMaxCols: 6,
    tableMaxCellChars: 80,
  });
  await fs.writeFile(
    path.join(outputDir, 'workbook-inspection.ndjson'),
    summary.ndjson ?? String(summary),
    'utf8',
  );
}

async function renderAllSheets(workbook) {
  await fs.mkdir(previewDir, { recursive: true });
  for (const sheet of workbook.worksheets.items) {
    const preview = await workbook.render({
      sheetName: sheet.name,
      autoCrop: 'all',
      scale: 0.8,
      format: 'png',
    });
    const safeName = sheet.name.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
    await fs.writeFile(
      path.join(previewDir, `${safeName}.png`),
      new Uint8Array(await preview.arrayBuffer()),
    );
  }
}

async function main() {
  validateAuthenticatedBrowserSmoke();
  await fs.mkdir(outputDir, { recursive: true });
  const workbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(sourcePath),
  );
  const routes = await extractNavigationRoutes();
  markInheritedBaseline(workbook);
  await addSheets(workbook, routes);
  await appendDefects(workbook);
  updateOverview(workbook, routes);
  await verifyWorkbook(workbook);
  await renderAllSheets(workbook);
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
  console.log(JSON.stringify({
    outputPath,
    routeInventory: navigationInventory(routes),
    sheetCount: workbook.worksheets.items.length,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
