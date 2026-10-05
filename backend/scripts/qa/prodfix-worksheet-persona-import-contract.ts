import { createHash } from 'node:crypto';

import { QA_STAGING_TARGET } from '../assert-destructive-db-guard';

/**
 * This deliberately fixed contract is not a general-purpose
 * account copier.  Keeping the selectors and the natural keys here makes it
 * impossible for a CLI argument or environment value to broaden the import.
 */
export const PRODFIX_WORKSHEET_PERSONA_EMAILS = Object.freeze([
  'prodfix.emp.20260917@example.test',
  'prodfix.hr.20260917@example.test',
  'prodfix.mgr.20260917@example.test',
  'prodfix.owner.20260917@example.test',
] as const);

export const PRODFIX_WORKSHEET_PERSONA_IMPORT_CONFIRMATION =
  'IMPORT-EXACTLY-FOUR-PRODFIX-WORKSHEET-QA-PERSONAS:dsp_pms_stg';

export const PRODFIX_WORKSHEET_PERSONA_CREDENTIAL_HASH_CONFIRMATION =
  'PRESERVE-EXACTLY-FOUR-PRODFIX-WORKSHEET-QA-CREDENTIAL-HASHES';

// This is deliberately checked in, not configurable. Bump it whenever the
// reviewed import semantics change so an older plan cannot authorize them.
export const PRODFIX_WORKSHEET_PERSONA_IMPORT_CONTRACT_VERSION = '2026-09-19.3';

export const PRODFIX_WORKSHEET_PERSONA_SOURCE_SCOPE = Object.freeze({
  groupCode: 'PFG-20260917',
  companyCode: 'PFC-20260917',
  branchCode: 'PFB-20260917',
  departmentCode: 'PFD-20260917',
});

/**
 * The staging/master product baseline enables every canonical Company module
 * for each QA Company. This is deliberately fixed here rather than inferred
 * from the older source tenant's roles, permissions, or configuration.
 */
export const PRODFIX_WORKSHEET_PERSONA_STAGING_MODULE_CODES = Object.freeze([
  'ASSETS',
  'DELIVERY',
  'FILE_STORAGE',
  'FINANCE',
  'ONBOARDING',
  'PAYROLL',
  'PROJECTS',
  'RECRUITMENT',
  'RECRUITMENT_SHORTLIST',
] as const);

export type ProdfixWorksheetRoleScope = 'COMPANY_GROUP' | 'COMPANY' | 'BRANCH';

type ExpectedRoleAssignment = Readonly<{
  roleCode: string;
  scope: ProdfixWorksheetRoleScope;
}>;

export type ProdfixWorksheetPersonaContract = Readonly<{
  email: (typeof PRODFIX_WORKSHEET_PERSONA_EMAILS)[number];
  username: string;
  employeeCode: string;
  designationCode: 'DES-SE-20260917' | 'DES-TL-20260917';
  roleAssignments: readonly ExpectedRoleAssignment[];
}>;

export const PRODFIX_WORKSHEET_PERSONA_CONTRACT = Object.freeze([
  {
    email: 'prodfix.emp.20260917@example.test',
    username: 'jamie.employee.db60',
    employeeCode: 'EMP-EMP-20260917',
    designationCode: 'DES-SE-20260917',
    roleAssignments: [{ roleCode: 'EMPLOYEE', scope: 'COMPANY' }],
  },
  {
    email: 'prodfix.hr.20260917@example.test',
    username: 'sam.hr.225a',
    employeeCode: 'EMP-HR-20260917',
    designationCode: 'DES-TL-20260917',
    roleAssignments: [{ roleCode: 'HR_MANAGER', scope: 'COMPANY' }],
  },
  {
    email: 'prodfix.mgr.20260917@example.test',
    username: 'alex.manager.5698',
    employeeCode: 'EMP-MGR-20260917',
    designationCode: 'DES-TL-20260917',
    roleAssignments: [
      { roleCode: 'ASSET_DEPARTMENT_CUSTODIAN', scope: 'BRANCH' },
      { roleCode: 'PROJECT_MANAGER', scope: 'COMPANY' },
    ],
  },
  {
    email: 'prodfix.owner.20260917@example.test',
    username: 'owner.admin.6675',
    employeeCode: 'EMP-OWN-20260917',
    designationCode: 'DES-TL-20260917',
    roleAssignments: [
      { roleCode: 'ORGANIZATION_OWNER', scope: 'COMPANY_GROUP' },
    ],
  },
] as const satisfies readonly ProdfixWorksheetPersonaContract[]);

export type CredentialMode =
  'FRESH_STAGING_PASSWORD_FOR_NEW_USERS' | 'PRESERVE_SOURCE_HASHES';

export type ProdfixWorksheetPersonaImportInvocation = Readonly<{
  mode: 'PLAN_ONLY' | 'APPLY';
  credentialMode: CredentialMode;
  reviewedPlanDigest?: string;
}>;

export type Environment =
  NodeJS.ProcessEnv | Record<string, string | undefined>;

export type CompanyGroupRecord = Readonly<{
  id: string;
  groupCode: string;
  groupName: string;
  description: string | null;
  isActive: boolean;
}>;

export type CompanyRecord = Readonly<{
  id: string;
  companyGroupId: string | null;
  companyCode: string;
  companyName: string;
  registrationNo: string | null;
  taxNumber: string | null;
  legalCountryCode: string | null;
  parentCompanyId: string | null;
  isActive: boolean;
}>;

export type BranchRecord = Readonly<{
  id: string;
  companyId: string;
  branchCode: string;
  branchName: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  countryCode: string | null;
  timezone: string | null;
  countrySubdivisionCode: string | null;
  isActive: boolean;
}>;

export type DepartmentRecord = Readonly<{
  id: string;
  companyId: string;
  branchId: string;
  departmentCode: string;
  departmentName: string;
  isActive: boolean;
}>;

export type DesignationRecord = Readonly<{
  id: string;
  companyId: string;
  departmentId: string | null;
  designationCode: string;
  designationName: string;
  level: number | null;
  isActive: boolean;
}>;

export type EmployeeRecord = Readonly<{
  id: string;
  employeeCode: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  mobile: string | null;
  designationId: string | null;
  joiningDate: Date | string | null;
  employeeType: string | null;
  employmentStatus: string;
  creationSource: string;
  sourceCandidateId: string | null;
  isActive: boolean;
  managerId: string | null;
}>;

export type SourceUserRecord = Readonly<{
  id: string;
  username: string;
  normalizedUsername: string;
  displayName: string | null;
  email: string | null;
  normalizedEmail: string;
  emailVerifiedAt: Date | string | null;
  status: string;
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | string | null;
  employeeId: string | null;
  defaultCompanyGroupId: string | null;
  defaultCompanyId: string | null;
  defaultBranchId: string | null;
}>;

export type TargetUserRecord = SourceUserRecord &
  Readonly<{
    passwordHashPresent: boolean;
  }>;

export type RoleRecord = Readonly<{
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  companyGroupId: string | null;
}>;

export type RoleAssignmentRecord = Readonly<{
  userId: string;
  roleId: string;
  scope: ProdfixWorksheetRoleScope | 'GLOBAL';
  scopeKey: string;
  companyGroupId: string | null;
  companyId: string | null;
  branchId: string | null;
  isActive: boolean;
}>;

export type TargetRoleAssignmentRecord = RoleAssignmentRecord &
  Readonly<{
    userNormalizedEmail: string;
    roleCode: string;
  }>;

export type ModuleEntitlementRecord = Readonly<{
  id: string;
  companyId: string;
  module: string;
  isEnabled: boolean;
}>;

export type OrganizationOnboardingRecord = Readonly<{
  id: string;
  companyGroupId: string;
  ownerUserId: string;
  status: string;
  currentStep: string;
  completedAt: Date | string | null;
}>;

export type DepartmentAssetGrantRecord = Readonly<{
  id: string;
  companyId: string;
  branchId: string;
  departmentId: string;
  userId: string;
  grantedByUserId: string;
  revokedAt: Date | string | null;
  revokedByUserId: string | null;
}>;

export type SourceRolePermission = Readonly<{
  roleId: string;
  permissionCode: string;
}>;

export type TargetRolePermission = SourceRolePermission;

export type ProdfixWorksheetSourceSnapshot = Readonly<{
  group: CompanyGroupRecord;
  company: CompanyRecord;
  branch: BranchRecord;
  department: DepartmentRecord;
  designations: readonly DesignationRecord[];
  employees: readonly EmployeeRecord[];
  users: readonly SourceUserRecord[];
  roles: readonly RoleRecord[];
  assignments: readonly RoleAssignmentRecord[];
  rolePermissions: readonly SourceRolePermission[];
  onboarding: OrganizationOnboardingRecord;
  departmentAssetGrants: readonly DepartmentAssetGrantRecord[];
  // An opaque, domain-separated SHA-256 commitment over the exact four
  // source credential hashes. It is present only in preservation mode.
  credentialHashCommitment: string | null;
}>;

export type ProdfixWorksheetTargetSnapshot = Readonly<{
  group: CompanyGroupRecord | null;
  company: CompanyRecord | null;
  branch: BranchRecord | null;
  department: DepartmentRecord | null;
  designations: readonly DesignationRecord[];
  employees: readonly EmployeeRecord[];
  users: readonly TargetUserRecord[];
  roles: readonly RoleRecord[];
  assignments: readonly TargetRoleAssignmentRecord[];
  rolePermissions: readonly TargetRolePermission[];
  entitlements: readonly ModuleEntitlementRecord[];
  onboarding: OrganizationOnboardingRecord | null;
  departmentAssetGrants: readonly DepartmentAssetGrantRecord[];
  // The equivalent opaque target commitment is present only in preservation
  // mode. It never contains a credential hash or source/target identifier.
  credentialHashCommitment: string | null;
  activeSessionUserIds: readonly string[];
}>;

type PlanAction = 'CREATE' | 'NOOP' | 'CREATE_OR_VERIFY_AFTER_COMPANY_CREATE';

export type ProdfixWorksheetPersonaImportPlan = Readonly<{
  format: 'DSP_PMS_PRODFIX_WORKSHEET_PERSONA_IMPORT';
  contractVersion: typeof PRODFIX_WORKSHEET_PERSONA_IMPORT_CONTRACT_VERSION;
  mode: 'PLAN_ONLY' | 'APPLY';
  target: Readonly<{
    databaseName: string;
    databaseSchema: string;
    databaseUser: string;
  }>;
  selectors: readonly string[];
  sourceDigest: string;
  targetFingerprint: string;
  planDigest: string;
  credentialHandling: Readonly<{
    mode: CredentialMode;
    sourceCredentialState:
      'NOT_READ' | 'PRESERVE_EXACT_FOUR_HASHES_BOUND_TO_PLAN';
    users: readonly Readonly<{
      email: string;
      targetCredentialState: 'ABSENT' | 'PRESENT' | 'MISSING';
    }>[];
  }>;
  sessionSafety: Readonly<{
    activeSessionCount: 0;
    reAuthenticationRequiredForExistingUsers: readonly string[];
  }>;
  actions: Readonly<{
    companyGroup: Readonly<{ groupCode: string; action: PlanAction }>;
    company: Readonly<{ companyCode: string; action: PlanAction }>;
    branch: Readonly<{ branchCode: string; action: PlanAction }>;
    department: Readonly<{ departmentCode: string; action: PlanAction }>;
    designations: readonly Readonly<{
      designationCode: string;
      action: PlanAction;
    }>[];
    employees: readonly Readonly<{
      employeeCode: string;
      action: PlanAction;
      managerEmployeeCode: string | null;
    }>[];
    users: readonly Readonly<{ email: string; action: PlanAction }>[];
    roleAssignments: readonly Readonly<{
      email: string;
      roleCode: string;
      scope: ProdfixWorksheetRoleScope;
      action: PlanAction;
    }>[];
    moduleEntitlements: readonly Readonly<{
      companyCode: string;
      module: string;
      action: PlanAction;
    }>[];
    organizationOnboarding: Readonly<{
      groupCode: string;
      ownerEmail: string;
      action: PlanAction;
    }>;
    departmentAssetGrant: Readonly<{
      userEmail: string;
      grantedByEmail: string;
      departmentCode: string;
      action: PlanAction;
    }>;
  }>;
  excludedData: readonly string[];
}>;

export type PreparedProdfixWorksheetPersonaImport = Readonly<{
  source: ProdfixWorksheetSourceSnapshot;
  target: ProdfixWorksheetTargetSnapshot;
  employeeInsertOrder: readonly EmployeeRecord[];
  requiredModules: readonly string[];
  plan: ProdfixWorksheetPersonaImportPlan;
}>;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function digest(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/**
 * Produces an opaque commitment over credential hashes without retaining or
 * exposing them. The domain keeps source and target commitments distinct.
 * Callers must pass only the four fixed email keys; missing keys intentionally
 * represent absent target credentials.
 */
export function credentialHashCommitmentForProdfixWorksheetPersonas(
  domain: 'source' | 'target',
  hashes: ReadonlyMap<string, string | null>,
): string {
  const records = PRODFIX_WORKSHEET_PERSONA_EMAILS.map((email) => {
    const value = hashes.get(email);
    return {
      email,
      state: !hashes.has(email)
        ? 'ABSENT'
        : value && value.trim()
          ? 'PRESENT'
          : 'MISSING',
      hashCommitment:
        value && value.trim()
          ? createHash('sha256')
              .update('DSP_PMS_PRODFIX_WORKSHEET_PERSONA_CREDENTIAL_HASH\u0000')
              .update(value)
              .digest('hex')
          : null,
    };
  });
  return digest({
    domain: `DSP_PMS_PRODFIX_WORKSHEET_PERSONA_${domain.toUpperCase()}_CREDENTIAL_COMMITMENT`,
    records,
  });
}

function dateValue(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('A persona record contains an invalid timestamp.');
  }
  return parsed.toISOString();
}

function assertExactSet(
  values: readonly string[],
  expected: readonly string[],
  label: string,
): void {
  const actual = [...new Set(values.map(normalize))].sort();
  const wanted = [...new Set(expected.map(normalize))].sort();
  if (
    actual.length !== values.length ||
    actual.length !== wanted.length ||
    actual.some((value, index) => value !== wanted[index])
  ) {
    throw new Error(`${label} does not match the strict approved contract.`);
  }
}

export function resolveProdfixWorksheetPersonaSelectors(
  environment: Environment = process.env,
): readonly string[] {
  const configured = environment.QA_PRODFIX_WORKSHEET_PERSONA_EMAILS?.trim();
  if (!configured) {
    return [...PRODFIX_WORKSHEET_PERSONA_EMAILS];
  }
  const selectors = configured
    .split(',')
    .map((value) => normalize(value))
    .filter(Boolean);
  assertExactSet(
    selectors,
    PRODFIX_WORKSHEET_PERSONA_EMAILS,
    'QA_PRODFIX_WORKSHEET_PERSONA_EMAILS',
  );
  return [...PRODFIX_WORKSHEET_PERSONA_EMAILS];
}

export function parseProdfixWorksheetPersonaImportArguments(
  arguments_: readonly string[],
): ProdfixWorksheetPersonaImportInvocation {
  let apply = false;
  let preserveCredentialHashes = false;
  let reviewedPlanDigest: string | undefined;

  for (const argument of arguments_) {
    if (argument === '--apply') {
      if (apply) {
        throw new Error(
          'Usage: import-prodfix-worksheet-personas [--apply --plan-digest=<sha256>] [--preserve-credential-hashes]',
        );
      }
      apply = true;
      continue;
    }
    if (argument === '--preserve-credential-hashes') {
      if (preserveCredentialHashes) {
        throw new Error(
          'Usage: import-prodfix-worksheet-personas [--apply --plan-digest=<sha256>] [--preserve-credential-hashes]',
        );
      }
      preserveCredentialHashes = true;
      continue;
    }
    if (argument.startsWith('--plan-digest=')) {
      if (reviewedPlanDigest) {
        throw new Error(
          'Usage: import-prodfix-worksheet-personas [--apply --plan-digest=<sha256>] [--preserve-credential-hashes]',
        );
      }
      const candidate = argument.slice('--plan-digest='.length);
      if (!/^[a-f0-9]{64}$/.test(candidate)) {
        throw new Error(
          '--plan-digest must be a lowercase SHA-256 hex digest.',
        );
      }
      reviewedPlanDigest = candidate;
      continue;
    }
    throw new Error(
      'Usage: import-prodfix-worksheet-personas [--apply --plan-digest=<sha256>] [--preserve-credential-hashes]',
    );
  }

  if (!apply && reviewedPlanDigest) {
    throw new Error('--plan-digest is accepted only together with --apply.');
  }
  if (apply && !reviewedPlanDigest) {
    throw new Error(
      '--apply requires --plan-digest=<the reviewed planDigest>.',
    );
  }
  return {
    mode: apply ? 'APPLY' : 'PLAN_ONLY',
    credentialMode: preserveCredentialHashes
      ? 'PRESERVE_SOURCE_HASHES'
      : 'FRESH_STAGING_PASSWORD_FOR_NEW_USERS',
    reviewedPlanDigest,
  };
}

export function assertProdfixWorksheetPersonaApplyConfirmations(
  invocation: ProdfixWorksheetPersonaImportInvocation,
  environment: Environment = process.env,
): void {
  if (invocation.mode !== 'APPLY') {
    return;
  }
  if (
    environment.QA_PRODFIX_WORKSHEET_PERSONA_IMPORT_CONFIRMATION !==
    PRODFIX_WORKSHEET_PERSONA_IMPORT_CONFIRMATION
  ) {
    throw new Error(
      'QA_PRODFIX_WORKSHEET_PERSONA_IMPORT_CONFIRMATION does not authorize this exact four-persona staging import.',
    );
  }
  if (
    invocation.credentialMode === 'PRESERVE_SOURCE_HASHES' &&
    environment.QA_PRODFIX_WORKSHEET_PERSONA_CREDENTIAL_HASH_CONFIRMATION !==
      PRODFIX_WORKSHEET_PERSONA_CREDENTIAL_HASH_CONFIRMATION
  ) {
    throw new Error(
      'QA_PRODFIX_WORKSHEET_PERSONA_CREDENTIAL_HASH_CONFIRMATION is required to preserve the exact four source credential hashes.',
    );
  }
}

function mapById<T extends { id: string }>(
  rows: readonly T[],
  label: string,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    if (result.has(row.id)) {
      throw new Error(
        `Duplicate ${label} identifier in the bounded import snapshot.`,
      );
    }
    result.set(row.id, row);
  }
  return result;
}

function mapByField<T>(
  rows: readonly T[],
  field: (row: T) => string,
  label: string,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const row of rows) {
    const key = field(row);
    if (result.has(key)) {
      throw new Error(`Duplicate ${label} in the bounded import snapshot.`);
    }
    result.set(key, row);
  }
  return result;
}

function expectedAssignmentKey(
  email: string,
  roleCode: string,
  scope: ProdfixWorksheetRoleScope,
): string {
  return `${email}|${roleCode}|${scope}`;
}

function requiredLegalCountryCode(value: string | null, label: string): string {
  if (!value || !/^[A-Z]{2}$/.test(value)) {
    throw new Error(`${label} must be an uppercase ISO 3166-1 alpha-2 code.`);
  }
  return value;
}

/**
 * Older source schemas lack companies.legal_country_code. In that bounded
 * case, the one reviewed source Branch is the only permitted derivation.
 * A source that already has the physical column must retain its value and
 * prove it agrees with that same Branch; the importer never guesses.
 */
export function resolveProdfixWorksheetSourceLegalCountryCode(
  input: Readonly<{
    sourceColumnPresent: boolean;
    sourceLegalCountryCode: string | null;
    branchCountryCode: string | null;
  }>,
): string {
  const branchCountryCode = requiredLegalCountryCode(
    input.branchCountryCode,
    'The reviewed source Branch country code',
  );
  if (!input.sourceColumnPresent) {
    return branchCountryCode;
  }
  const sourceLegalCountryCode = requiredLegalCountryCode(
    input.sourceLegalCountryCode,
    'The source Company legal country code',
  );
  if (sourceLegalCountryCode !== branchCountryCode) {
    throw new Error(
      'The source Company legal country code must agree with the reviewed source Branch country code.',
    );
  }
  return sourceLegalCountryCode;
}

function assertSourceAssignmentScope(
  assignment: RoleAssignmentRecord,
  group: CompanyGroupRecord,
  company: CompanyRecord,
  branch: BranchRecord,
): void {
  if (assignment.scope === 'GLOBAL') {
    throw new Error(
      'The bounded importer refuses broad GLOBAL role assignments.',
    );
  }
  if (assignment.scope === 'COMPANY_GROUP') {
    if (
      assignment.companyGroupId !== group.id ||
      assignment.companyId !== null ||
      assignment.branchId !== null ||
      assignment.scopeKey !== `COMPANY_GROUP:${group.id}`
    ) {
      throw new Error(
        'A source Company Group assignment is outside the approved closure.',
      );
    }
    return;
  }
  if (assignment.scope === 'COMPANY') {
    if (
      assignment.companyGroupId !== null ||
      assignment.companyId !== company.id ||
      assignment.branchId !== null ||
      assignment.scopeKey !== `COMPANY:${company.id}`
    ) {
      throw new Error(
        'A source Company assignment is outside the approved closure.',
      );
    }
    return;
  }
  if (
    assignment.companyGroupId !== null ||
    assignment.companyId !== company.id ||
    assignment.branchId !== branch.id ||
    assignment.scopeKey !== `BRANCH:${branch.id}`
  ) {
    throw new Error(
      'A source Branch assignment is outside the approved closure.',
    );
  }
}

function assertAcyclicEmployeeManagers(
  employees: readonly EmployeeRecord[],
): void {
  const byId = mapById(employees, 'Employee');
  for (const employee of employees) {
    const visited = new Set<string>();
    let current: EmployeeRecord | undefined = employee;
    while (current?.managerId) {
      if (visited.has(current.id)) {
        throw new Error(
          'The bounded employee manager closure contains a cycle.',
        );
      }
      visited.add(current.id);
      const manager = byId.get(current.managerId);
      if (!manager) {
        throw new Error(
          `Employee ${employee.employeeCode} has a manager outside the four-persona closure.`,
        );
      }
      current = manager;
    }
  }
}

export function orderEmployeesForInsert(
  employees: readonly EmployeeRecord[],
): readonly EmployeeRecord[] {
  assertAcyclicEmployeeManagers(employees);
  const byId = mapById(employees, 'Employee');
  const complete = new Set<string>();
  const ordered: EmployeeRecord[] = [];
  const visit = (employee: EmployeeRecord): void => {
    if (complete.has(employee.id)) {
      return;
    }
    if (employee.managerId) {
      const manager = byId.get(employee.managerId);
      if (!manager) {
        throw new Error(
          `Employee ${employee.employeeCode} has an external manager.`,
        );
      }
      visit(manager);
    }
    complete.add(employee.id);
    ordered.push(employee);
  };
  [...employees]
    .sort((left, right) => left.employeeCode.localeCompare(right.employeeCode))
    .forEach(visit);
  return ordered;
}

/**
 * Validates that the source reader returned only the independently reviewed
 * closure. It contains no source IDs or raw credentials. Preservation mode
 * may carry only an opaque commitment, which binds the plan without exposing
 * a password hash.
 */
export function validateProdfixWorksheetSourceSnapshot(
  source: ProdfixWorksheetSourceSnapshot,
): void {
  if (
    source.group.groupCode !==
      PRODFIX_WORKSHEET_PERSONA_SOURCE_SCOPE.groupCode ||
    source.company.companyCode !==
      PRODFIX_WORKSHEET_PERSONA_SOURCE_SCOPE.companyCode ||
    source.branch.branchCode !==
      PRODFIX_WORKSHEET_PERSONA_SOURCE_SCOPE.branchCode ||
    source.department.departmentCode !==
      PRODFIX_WORKSHEET_PERSONA_SOURCE_SCOPE.departmentCode
  ) {
    throw new Error(
      'The source organization does not match the reviewed PFG/PFC/PFB/PFD closure.',
    );
  }
  if (
    source.company.companyGroupId !== source.group.id ||
    source.company.parentCompanyId !== null ||
    source.branch.companyId !== source.company.id ||
    source.department.companyId !== source.company.id ||
    source.department.branchId !== source.branch.id
  ) {
    throw new Error(
      'A source parent dependency falls outside the reviewed organization closure.',
    );
  }
  if (
    source.company.legalCountryCode !==
    requiredLegalCountryCode(
      source.branch.countryCode,
      'The reviewed source Branch country code',
    )
  ) {
    throw new Error(
      'The source Company legal country code must agree with the reviewed source Branch country code.',
    );
  }

  if (source.users.length !== PRODFIX_WORKSHEET_PERSONA_EMAILS.length) {
    throw new Error(
      'The source query did not resolve exactly four approved users.',
    );
  }
  const usersByEmail = mapByField(
    source.users,
    (user) => normalize(user.normalizedEmail),
    'normalized source email',
  );
  assertExactSet(
    [...usersByEmail.keys()],
    PRODFIX_WORKSHEET_PERSONA_EMAILS,
    'Source selectors',
  );
  const employeesById = mapById(source.employees, 'Employee');
  const employeesByCode = mapByField(
    source.employees,
    (employee) => employee.employeeCode,
    'Employee code',
  );
  if (employeesByCode.size !== PRODFIX_WORKSHEET_PERSONA_CONTRACT.length) {
    throw new Error(
      'The source employee closure must contain exactly four employees.',
    );
  }

  const designationsById = mapById(source.designations, 'Designation');
  const expectedDesignationCodes = PRODFIX_WORKSHEET_PERSONA_CONTRACT.map(
    (persona) => persona.designationCode,
  );
  assertExactSet(
    source.designations.map((designation) => designation.designationCode),
    [...new Set(expectedDesignationCodes)],
    'Source designation codes',
  );
  for (const designation of source.designations) {
    if (
      designation.companyId !== source.company.id ||
      (designation.departmentId !== null &&
        designation.departmentId !== source.department.id)
    ) {
      throw new Error(
        'A source designation has a dependency outside the reviewed closure.',
      );
    }
  }

  const selectedEmployeeIds = new Set<string>();
  for (const persona of PRODFIX_WORKSHEET_PERSONA_CONTRACT) {
    const user = usersByEmail.get(persona.email);
    if (!user) {
      throw new Error(`The source user ${persona.email} is missing.`);
    }
    if (
      user.username !== persona.username ||
      user.normalizedUsername !== persona.username ||
      user.normalizedEmail !== persona.email ||
      normalize(user.email ?? '') !== persona.email ||
      user.status !== 'ACTIVE' ||
      user.mustChangePassword ||
      user.failedLoginAttempts !== 0 ||
      user.lockedUntil !== null ||
      !user.employeeId
    ) {
      throw new Error(
        `The source user ${persona.email} diverges from its reviewed natural-key contract.`,
      );
    }
    if (
      user.defaultCompanyGroupId !== null &&
      user.defaultCompanyGroupId !== source.group.id
    ) {
      throw new Error(
        `The source user ${persona.email} has a default group outside the closure.`,
      );
    }
    if (
      user.defaultCompanyId !== null &&
      user.defaultCompanyId !== source.company.id
    ) {
      throw new Error(
        `The source user ${persona.email} has a default company outside the closure.`,
      );
    }
    if (
      user.defaultBranchId !== null &&
      user.defaultBranchId !== source.branch.id
    ) {
      throw new Error(
        `The source user ${persona.email} has a default branch outside the closure.`,
      );
    }
    const employee = employeesById.get(user.employeeId);
    if (!employee || employee.employeeCode !== persona.employeeCode) {
      throw new Error(
        `The source user ${persona.email} is not linked to its reviewed Employee.`,
      );
    }
    if (selectedEmployeeIds.has(employee.id)) {
      throw new Error('Two selected source users share an Employee record.');
    }
    selectedEmployeeIds.add(employee.id);
    if (
      employee.companyId !== source.company.id ||
      employee.branchId !== source.branch.id ||
      employee.departmentId !== source.department.id ||
      employee.sourceCandidateId !== null
    ) {
      throw new Error(
        `Employee ${employee.employeeCode} has an external or transactional dependency.`,
      );
    }
    const designation = employee.designationId
      ? designationsById.get(employee.designationId)
      : undefined;
    if (
      !designation ||
      designation.designationCode !== persona.designationCode
    ) {
      throw new Error(
        `Employee ${employee.employeeCode} does not use its reviewed Designation.`,
      );
    }
  }
  if (selectedEmployeeIds.size !== employeesById.size) {
    throw new Error(
      'The source employee reader returned an Employee outside the selected user closure.',
    );
  }

  const approvedEmployeeCodes = new Set<string>(
    PRODFIX_WORKSHEET_PERSONA_CONTRACT.map((persona) => persona.employeeCode),
  );
  const employee = employeesByCode.get('EMP-EMP-20260917');
  const manager = employeesByCode.get('EMP-MGR-20260917');
  if (!employee || !manager || employee.managerId !== manager.id) {
    throw new Error(
      'EMP-EMP-20260917 must report to EMP-MGR-20260917 inside the bounded closure.',
    );
  }
  for (const record of source.employees) {
    if (!approvedEmployeeCodes.has(record.employeeCode)) {
      throw new Error(
        'The source employee reader returned an unapproved Employee code.',
      );
    }
  }
  assertAcyclicEmployeeManagers(source.employees);

  const owner = usersByEmail.get('prodfix.owner.20260917@example.test');
  const managerUser = usersByEmail.get('prodfix.mgr.20260917@example.test');
  if (
    !owner ||
    !managerUser ||
    source.onboarding.companyGroupId !== source.group.id ||
    source.onboarding.ownerUserId !== owner.id ||
    source.onboarding.status !== 'COMPLETED'
  ) {
    throw new Error(
      'The source onboarding context is not the reviewed completed owner onboarding.',
    );
  }
  if (source.departmentAssetGrants.length !== 1) {
    throw new Error(
      'The source closure must contain exactly one Department Asset Grant.',
    );
  }
  const departmentAssetGrant = source.departmentAssetGrants[0];
  if (
    departmentAssetGrant.companyId !== source.company.id ||
    departmentAssetGrant.branchId !== source.branch.id ||
    departmentAssetGrant.departmentId !== source.department.id ||
    departmentAssetGrant.userId !== managerUser.id ||
    departmentAssetGrant.grantedByUserId !== owner.id ||
    departmentAssetGrant.revokedAt !== null ||
    departmentAssetGrant.revokedByUserId !== null
  ) {
    throw new Error(
      'The source Department Asset Grant is not the approved active manager grant.',
    );
  }

  const rolesById = mapById(source.roles, 'Role');
  const expectedAssignmentKeys = new Set<string>();
  for (const persona of PRODFIX_WORKSHEET_PERSONA_CONTRACT) {
    for (const assignment of persona.roleAssignments) {
      expectedAssignmentKeys.add(
        expectedAssignmentKey(
          persona.email,
          assignment.roleCode,
          assignment.scope,
        ),
      );
    }
  }
  if (source.assignments.some((assignment) => !assignment.isActive)) {
    throw new Error(
      'The source reader must not include inactive role assignments.',
    );
  }
  const actualAssignmentKeys = new Set<string>();
  for (const assignment of source.assignments) {
    const user = source.users.find(
      (candidate) => candidate.id === assignment.userId,
    );
    const role = rolesById.get(assignment.roleId);
    if (!user || !role) {
      throw new Error(
        'A source role assignment falls outside the selected user or role closure.',
      );
    }
    assertSourceAssignmentScope(
      assignment,
      source.group,
      source.company,
      source.branch,
    );
    if (assignment.scope === 'GLOBAL') {
      throw new Error('The source has a prohibited GLOBAL role assignment.');
    }
    const key = expectedAssignmentKey(
      normalize(user.normalizedEmail),
      role.code,
      assignment.scope,
    );
    if (!expectedAssignmentKeys.has(key) || actualAssignmentKeys.has(key)) {
      throw new Error(
        'The source has an unexpected or duplicate active role assignment.',
      );
    }
    actualAssignmentKeys.add(key);
  }
  if (
    actualAssignmentKeys.size !== expectedAssignmentKeys.size ||
    [...expectedAssignmentKeys].some((key) => !actualAssignmentKeys.has(key))
  ) {
    throw new Error(
      'The source active role assignments do not exactly match the reviewed contract.',
    );
  }

  const expectedRoleCodes = new Set(
    [...expectedAssignmentKeys].map((key) => key.split('|')[1]),
  );
  if (rolesById.size !== expectedRoleCodes.size) {
    throw new Error('The source role closure includes an unapproved role.');
  }
  for (const role of source.roles) {
    if (
      !expectedRoleCodes.has(role.code) ||
      !role.isActive ||
      (role.companyGroupId !== null && role.companyGroupId !== source.group.id)
    ) {
      throw new Error(
        'A source role is inactive, unapproved, or depends on an external group.',
      );
    }
  }
  for (const permission of source.rolePermissions) {
    if (!rolesById.has(permission.roleId)) {
      throw new Error(
        'A source permission mapping falls outside the selected roles.',
      );
    }
  }
}

function sourceRolePermissionsByCode(
  source: ProdfixWorksheetSourceSnapshot,
): Map<string, string[]> {
  const roles = mapById(source.roles, 'Role');
  const values = new Map<string, string[]>();
  for (const role of source.roles) {
    values.set(role.code, []);
  }
  for (const mapping of source.rolePermissions) {
    const role = roles.get(mapping.roleId);
    if (!role) {
      throw new Error('A role permission is outside the source closure.');
    }
    values.get(role.code)!.push(mapping.permissionCode);
  }
  for (const permissions of values.values()) {
    permissions.sort();
  }
  return values;
}

function targetRolePermissionsByCode(
  target: ProdfixWorksheetTargetSnapshot,
): Map<string, string[]> {
  const roles = mapById(target.roles, 'target Role');
  const values = new Map<string, string[]>();
  for (const role of target.roles) {
    values.set(role.code, []);
  }
  for (const mapping of target.rolePermissions) {
    const role = roles.get(mapping.roleId);
    if (!role) {
      throw new Error(
        'A target role permission is outside the bounded role closure.',
      );
    }
    values.get(role.code)!.push(mapping.permissionCode);
  }
  for (const permissions of values.values()) {
    permissions.sort();
  }
  return values;
}

function same(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

type ReferenceState = 'NONE' | 'SELECTED' | 'OUTSIDE_CLOSURE';

function sourceReferenceState(
  actualId: string | null,
  selectedId: string | null | undefined,
): 'NONE' | 'SELECTED' {
  if (actualId === null) {
    return 'NONE';
  }
  if (actualId !== selectedId) {
    throw new Error(
      'A source relationship falls outside the approved closure.',
    );
  }
  return 'SELECTED';
}

function targetReferenceState(
  actualId: string | null,
  selectedId: string | null | undefined,
): ReferenceState {
  if (actualId === null) {
    return 'NONE';
  }
  return actualId === selectedId ? 'SELECTED' : 'OUTSIDE_CLOSURE';
}

function sourceEmployeeComparable(
  employee: EmployeeRecord,
  source: ProdfixWorksheetSourceSnapshot,
): Record<string, unknown> {
  const designations = mapById(source.designations, 'Designation');
  const manager = employee.managerId
    ? mapById(source.employees, 'Employee').get(employee.managerId)
    : null;
  const designation = employee.designationId
    ? designations.get(employee.designationId)
    : null;
  return {
    employeeCode: employee.employeeCode,
    companyRelation: sourceReferenceState(
      employee.companyId,
      source.company.id,
    ),
    branchRelation: sourceReferenceState(employee.branchId, source.branch.id),
    departmentRelation: sourceReferenceState(
      employee.departmentId,
      source.department.id,
    ),
    designationRelation: sourceReferenceState(
      employee.designationId,
      designation?.id,
    ),
    designationCode: designation?.designationCode ?? null,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    mobile: employee.mobile,
    joiningDate: dateValue(employee.joiningDate),
    employeeType: employee.employeeType,
    employmentStatus: employee.employmentStatus,
    // These staged QA identities are created deliberately now, not imported as
    // historic/recruitment provenance. Candidate provenance is rejected above.
    creationSource: 'MANUAL',
    sourceCandidateId: null,
    isActive: employee.isActive,
    managerRelation: sourceReferenceState(employee.managerId, manager?.id),
    managerEmployeeCode: manager?.employeeCode ?? null,
  };
}

function targetEmployeeComparable(
  employee: EmployeeRecord,
  target: ProdfixWorksheetTargetSnapshot,
): Record<string, unknown> {
  const designation = employee.designationId
    ? mapById(target.designations, 'target Designation').get(
        employee.designationId,
      )
    : null;
  const manager = employee.managerId
    ? mapById(target.employees, 'target Employee').get(employee.managerId)
    : null;
  const companyRelation = targetReferenceState(
    employee.companyId,
    target.company?.id,
  );
  const branchRelation = targetReferenceState(
    employee.branchId,
    target.branch?.id,
  );
  const departmentRelation = targetReferenceState(
    employee.departmentId,
    target.department?.id,
  );
  const designationRelation = targetReferenceState(
    employee.designationId,
    designation?.id,
  );
  const managerRelation = targetReferenceState(employee.managerId, manager?.id);
  return {
    employeeCode: employee.employeeCode,
    companyRelation,
    branchRelation,
    departmentRelation,
    designationRelation,
    designationCode:
      designationRelation === 'SELECTED'
        ? (designation?.designationCode ?? null)
        : null,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    mobile: employee.mobile,
    joiningDate: dateValue(employee.joiningDate),
    employeeType: employee.employeeType,
    employmentStatus: employee.employmentStatus,
    creationSource: employee.creationSource,
    sourceCandidateId: employee.sourceCandidateId,
    isActive: employee.isActive,
    managerRelation,
    managerEmployeeCode:
      managerRelation === 'SELECTED' ? (manager?.employeeCode ?? null) : null,
  };
}

function sourceUserComparable(
  user: SourceUserRecord,
  source: ProdfixWorksheetSourceSnapshot,
): Record<string, unknown> {
  const employee = user.employeeId
    ? mapById(source.employees, 'Employee').get(user.employeeId)
    : null;
  return {
    username: user.username,
    normalizedUsername: user.normalizedUsername,
    displayName: user.displayName,
    email: user.email,
    normalizedEmail: user.normalizedEmail,
    emailVerifiedAt: dateValue(user.emailVerifiedAt),
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    failedLoginAttempts: 0,
    lockedUntil: null,
    employeeRelation: sourceReferenceState(user.employeeId, employee?.id),
    employeeCode: employee?.employeeCode ?? null,
    defaultGroupRelation: sourceReferenceState(
      user.defaultCompanyGroupId,
      source.group.id,
    ),
    defaultCompanyRelation: sourceReferenceState(
      user.defaultCompanyId,
      source.company.id,
    ),
    defaultBranchRelation: sourceReferenceState(
      user.defaultBranchId,
      source.branch.id,
    ),
  };
}

function targetUserComparable(
  user: TargetUserRecord,
  target: ProdfixWorksheetTargetSnapshot,
): Record<string, unknown> {
  const employee = user.employeeId
    ? mapById(target.employees, 'target Employee').get(user.employeeId)
    : null;
  const employeeRelation = targetReferenceState(user.employeeId, employee?.id);
  return {
    username: user.username,
    normalizedUsername: user.normalizedUsername,
    displayName: user.displayName,
    email: user.email,
    normalizedEmail: user.normalizedEmail,
    emailVerifiedAt: dateValue(user.emailVerifiedAt),
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    failedLoginAttempts: user.failedLoginAttempts,
    lockedUntil: dateValue(user.lockedUntil),
    employeeRelation,
    employeeCode:
      employeeRelation === 'SELECTED' ? (employee?.employeeCode ?? null) : null,
    defaultGroupRelation: targetReferenceState(
      user.defaultCompanyGroupId,
      target.group?.id,
    ),
    defaultCompanyRelation: targetReferenceState(
      user.defaultCompanyId,
      target.company?.id,
    ),
    defaultBranchRelation: targetReferenceState(
      user.defaultBranchId,
      target.branch?.id,
    ),
  };
}

function sourceDigestPayload(
  source: ProdfixWorksheetSourceSnapshot,
): Record<string, unknown> {
  const rolePermissions = sourceRolePermissionsByCode(source);
  return {
    group: {
      groupCode: source.group.groupCode,
      groupName: source.group.groupName,
      description: source.group.description,
      isActive: source.group.isActive,
    },
    company: {
      companyCode: source.company.companyCode,
      groupRelation: sourceReferenceState(
        source.company.companyGroupId,
        source.group.id,
      ),
      companyName: source.company.companyName,
      registrationNo: source.company.registrationNo,
      taxNumber: source.company.taxNumber,
      legalCountryCode: source.company.legalCountryCode,
      parentCompanyRelation: sourceReferenceState(
        source.company.parentCompanyId,
        null,
      ),
      isActive: source.company.isActive,
    },
    branch: {
      companyRelation: sourceReferenceState(
        source.branch.companyId,
        source.company.id,
      ),
      branchCode: source.branch.branchCode,
      branchName: source.branch.branchName,
      addressLine1: source.branch.addressLine1,
      addressLine2: source.branch.addressLine2,
      city: source.branch.city,
      state: source.branch.state,
      postalCode: source.branch.postalCode,
      countryCode: source.branch.countryCode,
      timezone: source.branch.timezone,
      countrySubdivisionCode: source.branch.countrySubdivisionCode,
      isActive: source.branch.isActive,
    },
    department: {
      companyRelation: sourceReferenceState(
        source.department.companyId,
        source.company.id,
      ),
      branchRelation: sourceReferenceState(
        source.department.branchId,
        source.branch.id,
      ),
      departmentCode: source.department.departmentCode,
      departmentName: source.department.departmentName,
      isActive: source.department.isActive,
    },
    designations: source.designations
      .map((designation) => expectedDesignationComparable(designation, source))
      .sort((left, right) =>
        String(left.designationCode).localeCompare(
          String(right.designationCode),
        ),
      ),
    employees: source.employees
      .map((employee) => sourceEmployeeComparable(employee, source))
      .sort((left, right) =>
        String(left.employeeCode).localeCompare(String(right.employeeCode)),
      ),
    users: source.users
      .map((user) => sourceUserComparable(user, source))
      .sort((left, right) =>
        String(left.normalizedEmail).localeCompare(
          String(right.normalizedEmail),
        ),
      ),
    roles: source.roles
      .slice()
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((role) => ({
        ...sourceRoleComparable(role, source),
        permissionCodes: rolePermissions.get(role.code) ?? [],
      })),
    roleAssignments: source.assignments
      .map((assignment) => {
        const user = source.users.find(
          (candidate) => candidate.id === assignment.userId,
        )!;
        const role = source.roles.find(
          (candidate) => candidate.id === assignment.roleId,
        )!;
        return {
          email: normalize(user.normalizedEmail),
          roleCode: role.code,
          scope: assignment.scope,
          groupCode:
            assignment.companyGroupId === null ? null : source.group.groupCode,
          companyCode:
            assignment.companyId === null ? null : source.company.companyCode,
          branchCode:
            assignment.branchId === null ? null : source.branch.branchCode,
          isActive: assignment.isActive,
        };
      })
      .sort((left, right) =>
        stableStringify(left).localeCompare(stableStringify(right)),
      ),
    onboardingContext: {
      groupCode: source.group.groupCode,
      ownerEmail: 'prodfix.owner.20260917@example.test',
      sourceStatus: 'COMPLETED',
      // The historical REVIEW value is purposefully excluded: the target is
      // canonical COMPLETED/COMPLETED and does not inherit stale workflow state.
      targetStatus: 'COMPLETED',
      targetCurrentStep: 'COMPLETED',
    },
    departmentAssetGrant: {
      companyCode: source.company.companyCode,
      branchCode: source.branch.branchCode,
      departmentCode: source.department.departmentCode,
      userEmail: 'prodfix.mgr.20260917@example.test',
      grantedByEmail: 'prodfix.owner.20260917@example.test',
      active: true,
    },
    credentialHashCommitment: source.credentialHashCommitment,
  };
}

function assertEquivalentOrMissing(
  current: unknown,
  expected: unknown,
  label: string,
): PlanAction {
  if (current === null) {
    return 'CREATE';
  }
  if (!same(current, expected)) {
    throw new Error(
      `${label} exists in staging but diverges; this importer never overwrites or relinks records.`,
    );
  }
  return 'NOOP';
}

function targetCompanyComparable(
  target: CompanyRecord,
  group: CompanyGroupRecord | null,
): Record<string, unknown> {
  return {
    companyCode: target.companyCode,
    groupRelation: targetReferenceState(target.companyGroupId, group?.id),
    companyName: target.companyName,
    registrationNo: target.registrationNo,
    taxNumber: target.taxNumber,
    legalCountryCode: target.legalCountryCode,
    parentCompanyRelation: targetReferenceState(target.parentCompanyId, null),
    isActive: target.isActive,
  };
}

function targetBranchComparable(
  target: BranchRecord,
  company: CompanyRecord | null,
): Record<string, unknown> {
  return {
    companyRelation: targetReferenceState(target.companyId, company?.id),
    branchCode: target.branchCode,
    branchName: target.branchName,
    addressLine1: target.addressLine1,
    addressLine2: target.addressLine2,
    city: target.city,
    state: target.state,
    postalCode: target.postalCode,
    countryCode: target.countryCode,
    timezone: target.timezone,
    countrySubdivisionCode: target.countrySubdivisionCode,
    isActive: target.isActive,
  };
}

function targetDepartmentComparable(
  target: DepartmentRecord,
  company: CompanyRecord | null,
  branch: BranchRecord | null,
): Record<string, unknown> {
  return {
    companyRelation: targetReferenceState(target.companyId, company?.id),
    branchRelation: targetReferenceState(target.branchId, branch?.id),
    departmentCode: target.departmentCode,
    departmentName: target.departmentName,
    isActive: target.isActive,
  };
}

function sourceRoleComparable(
  role: RoleRecord,
  source: ProdfixWorksheetSourceSnapshot,
): Record<string, unknown> {
  return {
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isActive: role.isActive,
    companyGroupRelation: sourceReferenceState(
      role.companyGroupId,
      source.group.id,
    ),
  };
}

function targetRoleComparable(
  role: RoleRecord,
  target: ProdfixWorksheetTargetSnapshot,
): Record<string, unknown> {
  return {
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isActive: role.isActive,
    companyGroupRelation: targetReferenceState(
      role.companyGroupId,
      target.group?.id,
    ),
  };
}

function naturalTargetAssignmentKey(
  assignment: TargetRoleAssignmentRecord,
): string {
  return [
    normalize(assignment.userNormalizedEmail),
    assignment.roleCode,
    assignment.scope,
    assignment.companyGroupId ?? '',
    assignment.companyId ?? '',
    assignment.branchId ?? '',
  ].join('|');
}

function desiredTargetAssignmentKey(
  email: string,
  roleCode: string,
  scope: ProdfixWorksheetRoleScope,
  ids: {
    groupId: string | null;
    companyId: string | null;
    branchId: string | null;
  },
): string {
  if (scope === 'COMPANY_GROUP') {
    return [email, roleCode, scope, ids.groupId ?? '', '', ''].join('|');
  }
  if (scope === 'COMPANY') {
    return [email, roleCode, scope, '', ids.companyId ?? '', ''].join('|');
  }
  return [
    email,
    roleCode,
    scope,
    '',
    ids.companyId ?? '',
    ids.branchId ?? '',
  ].join('|');
}

function targetAssignmentScopeKey(
  scope: ProdfixWorksheetRoleScope,
  ids: {
    groupId: string | null;
    companyId: string | null;
    branchId: string | null;
  },
): string {
  if (scope === 'COMPANY_GROUP') {
    if (!ids.groupId) {
      throw new Error(
        'A Company Group role assignment has no staged group identity.',
      );
    }
    return `COMPANY_GROUP:${ids.groupId}`;
  }
  if (scope === 'COMPANY') {
    if (!ids.companyId) {
      throw new Error(
        'A Company role assignment has no staged company identity.',
      );
    }
    return `COMPANY:${ids.companyId}`;
  }
  if (!ids.companyId || !ids.branchId) {
    throw new Error(
      'A Branch role assignment has no staged Company or Branch identity.',
    );
  }
  return `BRANCH:${ids.branchId}`;
}

function validateTargetAssignmentClosure(
  target: ProdfixWorksheetTargetSnapshot,
  source: ProdfixWorksheetSourceSnapshot,
): void {
  const sourceEmails = new Set(
    source.users.map((user) => normalize(user.normalizedEmail)),
  );
  const sourceRoleCodes = new Set(source.roles.map((role) => role.code));
  for (const assignment of target.assignments) {
    if (!sourceEmails.has(normalize(assignment.userNormalizedEmail))) {
      throw new Error(
        'A target role assignment reader escaped the selected four-user closure.',
      );
    }
    if (!sourceRoleCodes.has(assignment.roleCode)) {
      if (assignment.isActive) {
        throw new Error(
          'A selected target user has an active role outside the reviewed role closure.',
        );
      }
      continue;
    }
    if (assignment.scope === 'GLOBAL') {
      throw new Error(
        'A selected target user has a prohibited GLOBAL role assignment.',
      );
    }
  }
}

function targetFingerprintPayload(
  source: ProdfixWorksheetSourceSnapshot,
  target: ProdfixWorksheetTargetSnapshot,
  actions: ProdfixWorksheetPersonaImportPlan['actions'],
): Record<string, unknown> {
  const targetRolePermissions = targetRolePermissionsByCode(target);
  return {
    target: {
      databaseName: QA_STAGING_TARGET.databaseName,
      databaseUser: QA_STAGING_TARGET.databaseUser,
      databaseSchema: QA_STAGING_TARGET.databaseSchema,
    },
    group: target.group
      ? {
          groupCode: target.group.groupCode,
          groupName: target.group.groupName,
          description: target.group.description,
          isActive: target.group.isActive,
        }
      : null,
    company: target.company
      ? targetCompanyComparable(target.company, target.group)
      : null,
    branch: target.branch
      ? targetBranchComparable(target.branch, target.company)
      : null,
    department: target.department
      ? targetDepartmentComparable(
          target.department,
          target.company,
          target.branch,
        )
      : null,
    designations: target.designations
      .map((designation) => actualDesignationComparable(designation, target))
      .sort((left, right) =>
        String(left.designationCode).localeCompare(
          String(right.designationCode),
        ),
      ),
    employees: target.employees
      .map((employee) => targetEmployeeComparable(employee, target))
      .sort((left, right) =>
        String(left.employeeCode).localeCompare(String(right.employeeCode)),
      ),
    users: target.users
      .map((user) => ({
        ...targetUserComparable(user, target),
        credentialState: user.passwordHashPresent ? 'PRESENT' : 'MISSING',
      }))
      .sort((left, right) =>
        stableStringify(left).localeCompare(stableStringify(right)),
      ),
    roles: target.roles
      .map((role) => ({
        ...targetRoleComparable(role, target),
        permissionCodes: targetRolePermissions.get(role.code) ?? [],
      }))
      .sort((left, right) =>
        stableStringify(left).localeCompare(stableStringify(right)),
      ),
    roleAssignments: target.assignments
      .map((assignment) => ({
        email: normalize(assignment.userNormalizedEmail),
        roleCode: assignment.roleCode,
        scope: assignment.scope,
        scopeKey: assignment.scopeKey,
        companyGroupId: assignment.companyGroupId,
        companyId: assignment.companyId,
        branchId: assignment.branchId,
        isActive: assignment.isActive,
      }))
      .sort((left, right) =>
        stableStringify(left).localeCompare(stableStringify(right)),
      ),
    moduleEntitlements: target.entitlements
      .map((entitlement) => ({
        companyId: entitlement.companyId,
        module: entitlement.module,
        isEnabled: entitlement.isEnabled,
      }))
      .sort((left, right) => left.module.localeCompare(right.module)),
    organizationOnboarding: target.onboarding
      ? {
          groupId: target.onboarding.companyGroupId,
          ownerUserId: target.onboarding.ownerUserId,
          status: target.onboarding.status,
          currentStep: target.onboarding.currentStep,
          completedAtPresent: target.onboarding.completedAt !== null,
        }
      : null,
    departmentAssetGrants: target.departmentAssetGrants
      .map((grant) => ({
        companyId: grant.companyId,
        branchId: grant.branchId,
        departmentId: grant.departmentId,
        userId: grant.userId,
        grantedByUserId: grant.grantedByUserId,
        revokedAtPresent: grant.revokedAt !== null,
        revokedByUserIdPresent: grant.revokedByUserId !== null,
      }))
      .sort((left, right) =>
        stableStringify(left).localeCompare(stableStringify(right)),
      ),
    credentialHashCommitment: target.credentialHashCommitment,
    activeSessionCount: target.activeSessionUserIds.length,
    actions,
  };
}

function expectedDesignationComparable(
  designation: DesignationRecord,
  source: ProdfixWorksheetSourceSnapshot,
): Record<string, unknown> {
  return {
    companyRelation: sourceReferenceState(
      designation.companyId,
      source.company.id,
    ),
    departmentRelation: sourceReferenceState(
      designation.departmentId,
      source.department.id,
    ),
    designationCode: designation.designationCode,
    designationName: designation.designationName,
    level: designation.level,
    isActive: designation.isActive,
  };
}

function actualDesignationComparable(
  designation: DesignationRecord,
  target: ProdfixWorksheetTargetSnapshot,
): Record<string, unknown> {
  return {
    companyRelation: targetReferenceState(
      designation.companyId,
      target.company?.id,
    ),
    departmentRelation: targetReferenceState(
      designation.departmentId,
      target.department?.id,
    ),
    designationCode: designation.designationCode,
    designationName: designation.designationName,
    level: designation.level,
    isActive: designation.isActive,
  };
}

export function prepareProdfixWorksheetPersonaImport(
  source: ProdfixWorksheetSourceSnapshot,
  target: ProdfixWorksheetTargetSnapshot,
  invocation: ProdfixWorksheetPersonaImportInvocation,
): PreparedProdfixWorksheetPersonaImport {
  validateProdfixWorksheetSourceSnapshot(source);
  validateTargetAssignmentClosure(target, source);
  if (
    invocation.credentialMode === 'PRESERVE_SOURCE_HASHES' &&
    (!source.credentialHashCommitment || !target.credentialHashCommitment)
  ) {
    throw new Error(
      'Credential preservation requires exact source and target commitments before planning.',
    );
  }
  if (
    invocation.credentialMode === 'FRESH_STAGING_PASSWORD_FOR_NEW_USERS' &&
    (source.credentialHashCommitment !== null ||
      target.credentialHashCommitment !== null)
  ) {
    throw new Error(
      'Fresh-password planning must not retain credential hash commitments.',
    );
  }
  if (target.activeSessionUserIds.length > 0) {
    throw new Error(
      'A selected staging persona has an active authentication session; revoke it and require re-authentication before this bounded import.',
    );
  }

  const sourceGroupComparable = {
    groupCode: source.group.groupCode,
    groupName: source.group.groupName,
    description: source.group.description,
    isActive: source.group.isActive,
  };
  const groupAction = assertEquivalentOrMissing(
    target.group
      ? {
          groupCode: target.group.groupCode,
          groupName: target.group.groupName,
          description: target.group.description,
          isActive: target.group.isActive,
        }
      : null,
    sourceGroupComparable,
    `Company Group ${source.group.groupCode}`,
  );
  const companyAction = assertEquivalentOrMissing(
    target.company
      ? targetCompanyComparable(target.company, target.group)
      : null,
    {
      companyCode: source.company.companyCode,
      groupRelation: 'SELECTED',
      companyName: source.company.companyName,
      registrationNo: source.company.registrationNo,
      taxNumber: source.company.taxNumber,
      legalCountryCode: source.company.legalCountryCode,
      parentCompanyRelation: 'NONE',
      isActive: source.company.isActive,
    },
    `Company ${source.company.companyCode}`,
  );
  const branchAction = assertEquivalentOrMissing(
    target.branch
      ? targetBranchComparable(target.branch, target.company)
      : null,
    {
      companyRelation: 'SELECTED',
      branchCode: source.branch.branchCode,
      branchName: source.branch.branchName,
      addressLine1: source.branch.addressLine1,
      addressLine2: source.branch.addressLine2,
      city: source.branch.city,
      state: source.branch.state,
      postalCode: source.branch.postalCode,
      countryCode: source.branch.countryCode,
      timezone: source.branch.timezone,
      countrySubdivisionCode: source.branch.countrySubdivisionCode,
      isActive: source.branch.isActive,
    },
    `Branch ${source.branch.branchCode}`,
  );
  const departmentAction = assertEquivalentOrMissing(
    target.department
      ? targetDepartmentComparable(
          target.department,
          target.company,
          target.branch,
        )
      : null,
    {
      companyRelation: 'SELECTED',
      branchRelation: 'SELECTED',
      departmentCode: source.department.departmentCode,
      departmentName: source.department.departmentName,
      isActive: source.department.isActive,
    },
    `Department ${source.department.departmentCode}`,
  );

  const targetDesignations = mapByField(
    target.designations,
    (designation) => designation.designationCode,
    'target Designation code',
  );
  const designationActions = source.designations
    .map((designation) => ({
      designation,
      action: assertEquivalentOrMissing(
        targetDesignations.has(designation.designationCode)
          ? actualDesignationComparable(
              targetDesignations.get(designation.designationCode)!,
              target,
            )
          : null,
        expectedDesignationComparable(designation, source),
        `Designation ${designation.designationCode}`,
      ),
    }))
    .sort((left, right) =>
      left.designation.designationCode.localeCompare(
        right.designation.designationCode,
      ),
    );

  const targetEmployees = mapByField(
    target.employees,
    (employee) => employee.employeeCode,
    'target Employee code',
  );
  const employeeActions = source.employees
    .map((employee) => ({
      employee,
      action: assertEquivalentOrMissing(
        targetEmployees.has(employee.employeeCode)
          ? targetEmployeeComparable(
              targetEmployees.get(employee.employeeCode)!,
              target,
            )
          : null,
        sourceEmployeeComparable(employee, source),
        `Employee ${employee.employeeCode}`,
      ),
    }))
    .sort((left, right) =>
      left.employee.employeeCode.localeCompare(right.employee.employeeCode),
    );

  const targetUsersByEmail = mapByField(
    target.users,
    (user) => normalize(user.normalizedEmail),
    'target normalized email',
  );
  const targetUsersByUsername = mapByField(
    target.users,
    (user) => normalize(user.normalizedUsername),
    'target normalized username',
  );
  const targetUsersByCanonicalEmail = new Map<string, TargetUserRecord>();
  const targetUsersByCanonicalUsername = new Map<string, TargetUserRecord>();
  for (const user of target.users) {
    if (user.email) {
      const email = normalize(user.email);
      if (targetUsersByCanonicalEmail.has(email)) {
        throw new Error(
          'Duplicate target canonical email in the bounded user closure.',
        );
      }
      targetUsersByCanonicalEmail.set(email, user);
    }
    const username = normalize(user.username);
    if (targetUsersByCanonicalUsername.has(username)) {
      throw new Error(
        'Duplicate target canonical username in the bounded user closure.',
      );
    }
    targetUsersByCanonicalUsername.set(username, user);
  }
  const targetUsersByEmployeeId = new Map<string, TargetUserRecord>();
  for (const user of target.users) {
    if (!user.employeeId) {
      continue;
    }
    if (targetUsersByEmployeeId.has(user.employeeId)) {
      throw new Error('Two target users share a selected Employee link.');
    }
    targetUsersByEmployeeId.set(user.employeeId, user);
  }

  const userActions = source.users
    .map((user) => {
      const email = normalize(user.normalizedEmail);
      const emailCandidates = [
        targetUsersByEmail.get(email),
        targetUsersByCanonicalEmail.get(email),
      ].filter((candidate): candidate is TargetUserRecord =>
        Boolean(candidate),
      );
      if (new Set(emailCandidates.map((candidate) => candidate.id)).size > 1) {
        throw new Error(
          `User ${email} has multiple canonical target-email collisions.`,
        );
      }
      const byEmail = emailCandidates[0] ?? null;
      const username = normalize(user.username);
      const usernameCandidates = [
        targetUsersByUsername.get(normalize(user.normalizedUsername)),
        targetUsersByCanonicalUsername.get(username),
      ].filter((candidate): candidate is TargetUserRecord =>
        Boolean(candidate),
      );
      if (
        new Set(usernameCandidates.map((candidate) => candidate.id)).size > 1
      ) {
        throw new Error(
          `User ${email} has multiple canonical target-username collisions.`,
        );
      }
      const byUsername = usernameCandidates[0];
      const sourceEmployee = user.employeeId
        ? mapById(source.employees, 'Employee').get(user.employeeId)
        : null;
      const targetEmployee = sourceEmployee
        ? targetEmployees.get(sourceEmployee.employeeCode)
        : null;
      const byEmployee = targetEmployee
        ? targetUsersByEmployeeId.get(targetEmployee.id)
        : undefined;
      if (
        (byUsername && byUsername.id !== byEmail?.id) ||
        (byEmployee && byEmployee.id !== byEmail?.id)
      ) {
        throw new Error(
          `User ${email} collides with a different target username or Employee link.`,
        );
      }
      if (byEmail && !byEmail.passwordHashPresent) {
        throw new Error(
          `User ${email} has no usable staging credential; the importer never resets credentials.`,
        );
      }
      return {
        user,
        action: assertEquivalentOrMissing(
          byEmail ? targetUserComparable(byEmail, target) : null,
          sourceUserComparable(user, source),
          `User ${email}`,
        ),
      };
    })
    .sort((left, right) =>
      normalize(left.user.normalizedEmail).localeCompare(
        normalize(right.user.normalizedEmail),
      ),
    );

  const sourceRolesByCode = mapByField(
    source.roles,
    (role) => role.code,
    'source Role code',
  );
  const targetRolesByCode = mapByField(
    target.roles,
    (role) => role.code,
    'target Role code',
  );
  for (const [code] of sourceRolesByCode) {
    const targetRole = targetRolesByCode.get(code);
    if (!targetRole) {
      throw new Error(
        `Required Role ${code} is absent from staging; roles and permissions are never copied.`,
      );
    }
    if (!targetRole.isActive || !targetRole.isSystem) {
      throw new Error(
        `Required Role ${code} is not an active staged system role; roles are never changed.`,
      );
    }
  }

  const ids = {
    groupId: target.group?.id ?? null,
    companyId: target.company?.id ?? null,
    branchId: target.branch?.id ?? null,
  };
  const desiredAssignmentKeys = new Set<string>();
  const targetAssignmentsByKey = new Map<string, TargetRoleAssignmentRecord>();
  for (const assignment of target.assignments) {
    const key = naturalTargetAssignmentKey(assignment);
    if (targetAssignmentsByKey.has(key)) {
      throw new Error(
        'Duplicate target role assignment found in the selected closure.',
      );
    }
    targetAssignmentsByKey.set(key, assignment);
  }
  const roleAssignments = source.assignments
    .map((assignment) => {
      const sourceUser = source.users.find(
        (user) => user.id === assignment.userId,
      )!;
      const sourceRole = source.roles.find(
        (role) => role.id === assignment.roleId,
      )!;
      const email = normalize(sourceUser.normalizedEmail);
      const scope = assignment.scope as ProdfixWorksheetRoleScope;
      const key = desiredTargetAssignmentKey(
        email,
        sourceRole.code,
        scope,
        ids,
      );
      desiredAssignmentKeys.add(key);
      const current = targetAssignmentsByKey.get(key);
      if (current && !current.isActive) {
        throw new Error(
          `Role assignment ${sourceRole.code} for ${email} is inactive in staging and will not be reactivated.`,
        );
      }
      if (
        current &&
        current.scopeKey !== targetAssignmentScopeKey(scope, ids)
      ) {
        throw new Error(
          `Role assignment ${sourceRole.code} for ${email} has an unsafe staged scope key.`,
        );
      }
      return {
        email,
        roleCode: sourceRole.code,
        scope,
        action: current ? ('NOOP' as const) : ('CREATE' as const),
      };
    })
    .sort((left, right) =>
      stableStringify(left).localeCompare(stableStringify(right)),
    );
  for (const assignment of target.assignments) {
    if (
      assignment.isActive &&
      !desiredAssignmentKeys.has(naturalTargetAssignmentKey(assignment))
    ) {
      throw new Error(
        `Target user ${assignment.userNormalizedEmail} has extra active access; the importer will not remove it.`,
      );
    }
  }
  const reAuthenticationRequiredForExistingUsers = [
    ...new Set(
      roleAssignments
        .filter((assignment) => assignment.action === 'CREATE')
        .filter((assignment) => targetUsersByEmail.has(assignment.email))
        .map((assignment) => assignment.email),
    ),
  ].sort();

  const requiredModules = PRODFIX_WORKSHEET_PERSONA_STAGING_MODULE_CODES;
  const targetEntitlementsByModule = mapByField(
    target.entitlements,
    (entitlement) => entitlement.module,
    'target module entitlement',
  );
  const moduleEntitlements = requiredModules.map((module) => {
    const existing = targetEntitlementsByModule.get(module);
    if (existing && !existing.isEnabled) {
      throw new Error(
        `Module entitlement ${module} is disabled in staging and will not be changed.`,
      );
    }
    if (existing && existing.companyId !== target.company?.id) {
      throw new Error(
        `Module entitlement ${module} belongs to an unexpected staging Company.`,
      );
    }
    return {
      companyCode: source.company.companyCode,
      module,
      action: target.company
        ? existing
          ? ('NOOP' as const)
          : ('CREATE' as const)
        : ('CREATE_OR_VERIFY_AFTER_COMPANY_CREATE' as const),
    };
  });

  const ownerEmail = 'prodfix.owner.20260917@example.test';
  const managerEmail = 'prodfix.mgr.20260917@example.test';
  const targetOwner = targetUsersByEmail.get(ownerEmail) ?? null;
  const targetManager = targetUsersByEmail.get(managerEmail) ?? null;
  let organizationOnboardingAction: PlanAction;
  if (!target.onboarding) {
    organizationOnboardingAction = 'CREATE';
  } else if (
    target.onboarding.companyGroupId !== target.group?.id ||
    target.onboarding.ownerUserId !== targetOwner?.id ||
    target.onboarding.status !== 'COMPLETED' ||
    target.onboarding.currentStep !== 'COMPLETED' ||
    target.onboarding.completedAt === null
  ) {
    throw new Error(
      'Organization onboarding exists in staging but is not the canonical completed owner context; it will not be overwritten.',
    );
  } else {
    organizationOnboardingAction = 'NOOP';
  }

  let departmentAssetGrantAction: PlanAction;
  if (target.departmentAssetGrants.length === 0) {
    departmentAssetGrantAction = 'CREATE';
  } else if (target.departmentAssetGrants.length !== 1) {
    throw new Error(
      'The selected target closure has extra Department Asset Grants; none will be removed.',
    );
  } else {
    const existingGrant = target.departmentAssetGrants[0];
    if (
      existingGrant.companyId !== target.company?.id ||
      existingGrant.branchId !== target.branch?.id ||
      existingGrant.departmentId !== target.department?.id ||
      existingGrant.userId !== targetManager?.id ||
      existingGrant.grantedByUserId !== targetOwner?.id ||
      existingGrant.revokedAt !== null ||
      existingGrant.revokedByUserId !== null
    ) {
      throw new Error(
        'The staged Department Asset Grant diverges from the exact active manager grant and will not be changed.',
      );
    }
    departmentAssetGrantAction = 'NOOP';
  }

  const actions = {
    companyGroup: { groupCode: source.group.groupCode, action: groupAction },
    company: { companyCode: source.company.companyCode, action: companyAction },
    branch: { branchCode: source.branch.branchCode, action: branchAction },
    department: {
      departmentCode: source.department.departmentCode,
      action: departmentAction,
    },
    designations: designationActions.map(({ designation, action }) => ({
      designationCode: designation.designationCode,
      action,
    })),
    employees: employeeActions.map(({ employee, action }) => ({
      employeeCode: employee.employeeCode,
      action,
      managerEmployeeCode: employee.managerId
        ? (mapById(source.employees, 'Employee').get(employee.managerId)
            ?.employeeCode ?? null)
        : null,
    })),
    users: userActions.map(({ user, action }) => ({
      email: normalize(user.normalizedEmail),
      action,
    })),
    roleAssignments,
    moduleEntitlements,
    organizationOnboarding: {
      groupCode: source.group.groupCode,
      ownerEmail,
      action: organizationOnboardingAction,
    },
    departmentAssetGrant: {
      userEmail: managerEmail,
      grantedByEmail: ownerEmail,
      departmentCode: source.department.departmentCode,
      action: departmentAssetGrantAction,
    },
  } as const;
  const sourceDigest = digest(sourceDigestPayload(source));
  const targetFingerprint = digest(
    targetFingerprintPayload(source, target, actions),
  );
  // The visible mode is intentionally excluded: an operator reviews a
  // PLAN_ONLY representation and must be able to bind that exact state to a
  // later APPLY invocation. Credential mode remains part of this payload.
  const planDigestPayload = {
    format: 'DSP_PMS_PRODFIX_WORKSHEET_PERSONA_IMPORT' as const,
    contractVersion: PRODFIX_WORKSHEET_PERSONA_IMPORT_CONTRACT_VERSION,
    target: {
      databaseName: QA_STAGING_TARGET.databaseName,
      databaseUser: QA_STAGING_TARGET.databaseUser,
      databaseSchema: QA_STAGING_TARGET.databaseSchema,
    },
    selectors: [...PRODFIX_WORKSHEET_PERSONA_EMAILS],
    sourceDigest,
    targetFingerprint,
    credentialHandling: {
      mode: invocation.credentialMode,
      sourceCredentialState:
        invocation.credentialMode === 'PRESERVE_SOURCE_HASHES'
          ? ('PRESERVE_EXACT_FOUR_HASHES_BOUND_TO_PLAN' as const)
          : ('NOT_READ' as const),
      users: PRODFIX_WORKSHEET_PERSONA_EMAILS.map((email) => {
        const targetUser = targetUsersByEmail.get(email);
        return {
          email,
          targetCredentialState: !targetUser
            ? ('ABSENT' as const)
            : targetUser.passwordHashPresent
              ? ('PRESENT' as const)
              : ('MISSING' as const),
        };
      }),
    },
    sessionSafety: {
      activeSessionCount: 0 as const,
      reAuthenticationRequiredForExistingUsers,
    },
    actions,
    excludedData: [
      'transactions',
      'settings',
      'files',
      'auth sessions',
      'invitations',
      'password reset challenges',
      'security events',
      'roles',
      'permissions',
      'password credentials in plan output',
    ],
  } as const;
  const plan: ProdfixWorksheetPersonaImportPlan = {
    ...planDigestPayload,
    mode: invocation.mode,
    planDigest: digest(planDigestPayload),
  };
  return {
    source,
    target,
    employeeInsertOrder: orderEmployeesForInsert(source.employees),
    requiredModules,
    plan,
  };
}

/** Visible to tests and the executable only; hashes are deliberately omitted. */
export function sourceDigestForProdfixWorksheetPersonaImport(
  source: ProdfixWorksheetSourceSnapshot,
): string {
  validateProdfixWorksheetSourceSnapshot(source);
  return digest(sourceDigestPayload(source));
}
