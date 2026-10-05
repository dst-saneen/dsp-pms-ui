import 'dotenv/config';

import { hash, verify as verifyArgon2 } from 'argon2';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import pg from 'pg';

import {
  assertNoPostgresEnvironmentOverrides,
  assertQaStagingSentinel,
  assertQaWriteEnvironment,
  createCanonicalStagingDatabaseUrl,
  QA_STAGING_TARGET,
  readQaSchemaFingerprint,
  type QaWriteTarget,
  type RawQueryClient,
} from '../assert-destructive-db-guard';
import {
  assertProdfixWorksheetPersonaApplyConfirmations,
  credentialHashCommitmentForProdfixWorksheetPersonas,
  parseProdfixWorksheetPersonaImportArguments,
  prepareProdfixWorksheetPersonaImport,
  PRODFIX_WORKSHEET_PERSONA_CONTRACT,
  PRODFIX_WORKSHEET_PERSONA_EMAILS,
  PRODFIX_WORKSHEET_PERSONA_STAGING_MODULE_CODES,
  resolveProdfixWorksheetSourceLegalCountryCode,
  resolveProdfixWorksheetPersonaSelectors,
  type BranchRecord,
  type CompanyGroupRecord,
  type CompanyRecord,
  type CredentialMode,
  type DepartmentAssetGrantRecord,
  type DepartmentRecord,
  type DesignationRecord,
  type EmployeeRecord,
  type Environment,
  type ModuleEntitlementRecord,
  type OrganizationOnboardingRecord,
  type PreparedProdfixWorksheetPersonaImport,
  type ProdfixWorksheetPersonaContract,
  type ProdfixWorksheetPersonaImportInvocation,
  type ProdfixWorksheetSourceSnapshot,
  type ProdfixWorksheetTargetSnapshot,
  type RoleAssignmentRecord,
  type RoleRecord,
  type SourceRolePermission,
  type SourceUserRecord,
  type TargetRoleAssignmentRecord,
  type TargetRolePermission,
  type TargetUserRecord,
} from './prodfix-worksheet-persona-import-contract';

const SCRIPT_NAME = 'qa:prodfix:worksheet-persona-import';
const SOURCE_SCHEMA = 'dsp_pms';
const CREDENTIAL_VALIDATION_PROBE =
  'dsp-pms-prodfix-worksheet-persona-credential-format-probe';
type QueryClient = Pick<pg.Client, 'query'>;

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function requiredEnvironment(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function asRawQueryClient(client: QueryClient): RawQueryClient {
  return {
    async $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T> {
      const result = await client.query(query, values as never[]);
      return result.rows as T;
    },
  };
}

function sslOptions(
  environment: Environment,
  caVariable: string,
): pg.ClientConfig['ssl'] | undefined {
  const caPath = environment[caVariable]?.trim();
  if (!caPath) {
    return undefined;
  }
  return {
    ca: readFileSync(resolve(process.cwd(), caPath), 'utf8'),
    rejectUnauthorized: true,
  };
}

function assertPlanTargetEnvironment(environment: Environment): QaWriteTarget {
  assertNoPostgresEnvironmentOverrides(environment);
  const target: QaWriteTarget = {
    databaseName: QA_STAGING_TARGET.databaseName,
    databaseUser: QA_STAGING_TARGET.databaseUser,
    databaseSchema: QA_STAGING_TARGET.databaseSchema,
    sentinelKey: QA_STAGING_TARGET.sentinelKey,
  };
  for (const [name, expected] of [
    ['DATABASE_NAME', target.databaseName],
    ['DATABASE_USER', target.databaseUser],
    ['DATABASE_SCHEMA', target.databaseSchema],
  ] as const) {
    const configured = environment[name]?.trim();
    if (configured && configured !== expected) {
      throw new Error(
        `${name} must match the approved staging target for this plan.`,
      );
    }
  }
  createCanonicalStagingDatabaseUrl(
    requiredEnvironment(environment, 'DATABASE_URL'),
    target,
  );
  return target;
}

function createSourceClient(
  target: QaWriteTarget,
  environment: Environment,
): pg.Client {
  const sourceUrl = new URL(
    createCanonicalStagingDatabaseUrl(
      requiredEnvironment(environment, 'DATABASE_URL'),
      target,
    ),
  );
  // The source uses the same approved endpoint and TLS configuration as the
  // staging writer. Its schema is set only inside its read-only transaction.
  sourceUrl.searchParams.delete('schema');
  return new pg.Client({
    connectionString: sourceUrl.toString(),
    ssl: sslOptions(environment, 'DATABASE_SSL_CA'),
  });
}

function createTargetClient(
  target: QaWriteTarget,
  environment: Environment,
): pg.Client {
  return new pg.Client({
    connectionString: createCanonicalStagingDatabaseUrl(
      requiredEnvironment(environment, 'DATABASE_URL'),
      target,
    ),
    ssl: sslOptions(environment, 'DATABASE_SSL_CA'),
  });
}

async function beginSourceSnapshot(client: pg.Client): Promise<void> {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query(`SET LOCAL search_path TO "${SOURCE_SCHEMA}"`);
  const result = await client.query<{
    currentDatabase: string;
    transactionReadOnly: string;
    currentSchema: string | null;
    sourceSchemaOnly: boolean;
  }>(
    `SELECT current_database() AS "currentDatabase",
            current_setting('transaction_read_only') AS "transactionReadOnly",
            current_schema() AS "currentSchema",
            current_schemas(false) = ARRAY[$1]::name[] AS "sourceSchemaOnly"`,
    [SOURCE_SCHEMA],
  );
  const runtime = result.rows[0];
  if (
    !runtime ||
    runtime.currentDatabase !== QA_STAGING_TARGET.databaseName ||
    runtime.transactionReadOnly !== 'on' ||
    runtime.currentSchema !== SOURCE_SCHEMA ||
    runtime.sourceSchemaOnly !== true
  ) {
    throw new Error(
      'The source connection is not the intended dsp_erp_dev/dsp_pms repeatable-read read-only snapshot.',
    );
  }
}

async function beginTargetSnapshot(
  client: pg.Client,
  target: QaWriteTarget,
  readOnly: boolean,
): Promise<void> {
  await client.query(
    readOnly
      ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
      : 'BEGIN ISOLATION LEVEL SERIALIZABLE',
  );
  await client.query(`SET LOCAL search_path TO "${target.databaseSchema}"`);
  await assertQaStagingSentinel(asRawQueryClient(client), SCRIPT_NAME, target);
}

function one<T>(rows: readonly T[], label: string): T {
  if (rows.length !== 1) {
    throw new Error(`Expected exactly one ${label} in the bounded snapshot.`);
  }
  return rows[0];
}

async function sourceHasLegalCountryCodeColumn(
  client: QueryClient,
): Promise<boolean> {
  const result = await client.query<{ legalCountryCodePresent: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'companies'
          AND column_name = 'legal_country_code'
     ) AS "legalCountryCodePresent"`,
  );
  return one(result.rows, 'source companies.legal_country_code metadata')
    .legalCountryCodePresent;
}

function exactlyOnePerId<T extends { id: string }>(
  rows: readonly T[],
  expectedIds: readonly string[],
  label: string,
): readonly T[] {
  const ids = new Set(rows.map((row) => row.id));
  if (
    ids.size !== rows.length ||
    ids.size !== expectedIds.length ||
    expectedIds.some((id) => !ids.has(id))
  ) {
    throw new Error(
      `The ${label} query did not return the exact bounded closure.`,
    );
  }
  return rows;
}

function toCompanyGroup(row: Record<string, unknown>): CompanyGroupRecord {
  return row as unknown as CompanyGroupRecord;
}

function toCompany(row: Record<string, unknown>): CompanyRecord {
  return row as unknown as CompanyRecord;
}

function toBranch(row: Record<string, unknown>): BranchRecord {
  return row as unknown as BranchRecord;
}

function toDepartment(row: Record<string, unknown>): DepartmentRecord {
  return row as unknown as DepartmentRecord;
}

function toDesignation(row: Record<string, unknown>): DesignationRecord {
  return row as unknown as DesignationRecord;
}

function toEmployee(row: Record<string, unknown>): EmployeeRecord {
  return row as unknown as EmployeeRecord;
}

function toSourceUser(row: Record<string, unknown>): SourceUserRecord {
  return row as unknown as SourceUserRecord;
}

function toTargetUser(row: Record<string, unknown>): TargetUserRecord {
  return row as unknown as TargetUserRecord;
}

function toRole(row: Record<string, unknown>): RoleRecord {
  return row as unknown as RoleRecord;
}

function allowedRoleCodes(): readonly string[] {
  const codes = new Set<string>();
  const personas: readonly ProdfixWorksheetPersonaContract[] =
    PRODFIX_WORKSHEET_PERSONA_CONTRACT;
  for (const persona of personas) {
    for (const assignment of persona.roleAssignments) {
      codes.add(assignment.roleCode);
    }
  }
  return [...codes].sort();
}

async function readSourceSnapshot(
  client: pg.Client,
  credentialMode: CredentialMode,
): Promise<ProdfixWorksheetSourceSnapshot> {
  const selectors = [...PRODFIX_WORKSHEET_PERSONA_EMAILS];
  const userResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "username", "normalizedUsername", "displayName", "email",
            "normalizedEmail", "emailVerifiedAt", "status"::text AS "status",
            "mustChangePassword", "failedLoginAttempts", "lockedUntil", "employeeId", "defaultCompanyGroupId",
            "defaultCompanyId", "defaultBranchId"
       FROM "users"
      WHERE "normalizedEmail" = ANY($1::text[])
      ORDER BY "normalizedEmail"`,
    [selectors],
  );
  const users = userResult.rows.map(toSourceUser);
  if (users.length !== selectors.length) {
    throw new Error(
      'The source user selector did not resolve exactly the approved four users.',
    );
  }
  const sourceCredentialHashes =
    credentialMode === 'PRESERVE_SOURCE_HASHES'
      ? await readExactSourceCredentialHashes(client)
      : null;
  const employeeIds = users
    .map((user) => user.employeeId)
    .filter((id): id is string => Boolean(id));
  if (
    employeeIds.length !== selectors.length ||
    new Set(employeeIds).size !== selectors.length
  ) {
    throw new Error(
      'The exact source users must each have a different Employee record.',
    );
  }
  const employeeResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "employeeCode", "companyId", "branchId", "departmentId",
            "firstName", "lastName", "email", "mobile", "designationId",
            "joiningDate", "employeeType", "employmentStatus",
            "creationSource"::text AS "creationSource", "sourceCandidateId",
            "isActive", "managerId"
       FROM "employees"
      WHERE "id" = ANY($1::text[])`,
    [employeeIds],
  );
  const employees = exactlyOnePerId(
    employeeResult.rows.map(toEmployee),
    employeeIds,
    'source Employee',
  );
  const companyIds = [
    ...new Set(employees.map((employee) => employee.companyId)),
  ];
  const sourceHasLegalCountryCode =
    await sourceHasLegalCountryCodeColumn(client);
  const sourceLegalCountryCodeProjection = sourceHasLegalCountryCode
    ? '"legal_country_code" AS "legalCountryCode"'
    : 'NULL::text AS "legalCountryCode"';
  const companyResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "companyGroupId", "companyCode", "companyName", "registrationNo",
            "taxNumber", ${sourceLegalCountryCodeProjection}, "parentCompanyId", "isActive"
       FROM "companies"
      WHERE "id" = ANY($1::text[])`,
    [companyIds],
  );
  const sourceCompany = toCompany(one(companyResult.rows, 'source Company'));
  if (!sourceCompany.companyGroupId) {
    throw new Error('The source Company has no Company Group.');
  }
  const groupResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "groupCode", "groupName", "description", "isActive"
      FROM "company_groups"
      WHERE "id" = $1`,
    [sourceCompany.companyGroupId],
  );
  const group = toCompanyGroup(one(groupResult.rows, 'source Company Group'));
  const branchIds = [
    ...new Set(employees.map((employee) => employee.branchId)),
  ];
  const branchResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "companyId", "branchCode", "branchName", "addressLine1",
            "addressLine2", "city", "state", "postalCode", "countryCode",
            "timezone", "countrySubdivisionCode", "isActive"
       FROM "branches"
      WHERE "id" = ANY($1::text[])`,
    [branchIds],
  );
  const branch = toBranch(one(branchResult.rows, 'source Branch'));
  const company: CompanyRecord = {
    ...sourceCompany,
    legalCountryCode: resolveProdfixWorksheetSourceLegalCountryCode({
      sourceColumnPresent: sourceHasLegalCountryCode,
      sourceLegalCountryCode: sourceCompany.legalCountryCode,
      branchCountryCode: branch.countryCode,
    }),
  };
  const departmentIds = [
    ...new Set(employees.map((employee) => employee.departmentId)),
  ];
  const departmentResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "companyId", "branchId", "departmentCode", "departmentName", "isActive"
       FROM "departments"
      WHERE "id" = ANY($1::text[])`,
    [departmentIds],
  );
  const department = toDepartment(
    one(departmentResult.rows, 'source Department'),
  );
  const designationIds = [
    ...new Set(
      employees
        .map((employee) => employee.designationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const designationResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "companyId", "departmentId", "designationCode", "designationName", "level", "isActive"
       FROM "designations"
      WHERE "id" = ANY($1::text[])`,
    [designationIds],
  );
  const designations = exactlyOnePerId(
    designationResult.rows.map(toDesignation),
    designationIds,
    'source Designation',
  );
  const assignmentResult = await client.query<Record<string, unknown>>(
    `SELECT assignment."userId", assignment."roleId", assignment."scope"::text AS "scope",
            assignment."scopeKey", assignment."companyGroupId", assignment."companyId",
            assignment."branchId", assignment."isActive",
            role."id" AS "roleRecordId", role."code" AS "roleCode",
            role."name" AS "roleName", role."description" AS "roleDescription",
            role."isSystem" AS "roleIsSystem", role."isActive" AS "roleIsActive",
            role."companyGroupId" AS "roleCompanyGroupId"
       FROM "user_role_assignments" AS assignment
       JOIN "roles" AS role ON role."id" = assignment."roleId"
      WHERE assignment."userId" = ANY($1::text[])
        AND assignment."isActive" = TRUE`,
    [users.map((user) => user.id)],
  );
  const assignments = assignmentResult.rows.map(
    (row) =>
      ({
        userId: row.userId,
        roleId: row.roleId,
        scope: row.scope,
        scopeKey: row.scopeKey,
        companyGroupId: row.companyGroupId,
        companyId: row.companyId,
        branchId: row.branchId,
        isActive: row.isActive,
      }) as unknown as RoleAssignmentRecord,
  );
  const roles = [
    ...new Map(
      assignmentResult.rows.map((row) => [
        String(row.roleRecordId),
        {
          id: row.roleRecordId,
          code: row.roleCode,
          name: row.roleName,
          description: row.roleDescription,
          isSystem: row.roleIsSystem,
          isActive: row.roleIsActive,
          companyGroupId: row.roleCompanyGroupId,
        } as RoleRecord,
      ]),
    ).values(),
  ];
  const rolePermissionResult = await client.query<Record<string, unknown>>(
    `SELECT mapping."roleId", permission."code" AS "permissionCode"
       FROM "role_permissions" AS mapping
       JOIN "permissions" AS permission ON permission."id" = mapping."permissionId"
      WHERE mapping."roleId" = ANY($1::text[])`,
    [roles.map((role) => role.id)],
  );
  const rolePermissions =
    rolePermissionResult.rows as unknown as SourceRolePermission[];
  const onboardingResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "companyGroupId", "ownerUserId", "status"::text AS "status",
            "currentStep"::text AS "currentStep", "completedAt"
       FROM "organization_onboardings"
      WHERE "companyGroupId" = $1`,
    [group.id],
  );
  const grantResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "companyId", "branchId", "departmentId", "userId",
            "grantedByUserId", "revokedAt", "revokedByUserId"
       FROM "department_asset_grants"
      WHERE "userId" = ANY($1::text[])`,
    [users.map((user) => user.id)],
  );
  return {
    group,
    company,
    branch,
    department,
    designations,
    employees,
    users,
    roles,
    assignments,
    rolePermissions,
    onboarding: one(
      onboardingResult.rows,
      'source OrganizationOnboarding',
    ) as unknown as OrganizationOnboardingRecord,
    departmentAssetGrants:
      grantResult.rows as unknown as DepartmentAssetGrantRecord[],
    credentialHashCommitment: sourceCredentialHashes
      ? credentialHashCommitmentForProdfixWorksheetPersonas(
          'source',
          sourceCredentialHashes,
        )
      : null,
  };
}

async function readTargetSnapshot(
  client: pg.Client,
  source: ProdfixWorksheetSourceSnapshot,
  credentialMode: CredentialMode,
): Promise<ProdfixWorksheetTargetSnapshot> {
  const targetCredentialHashes = await readExactTargetCredentialHashes(client);
  const groupResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "groupCode", "groupName", "description", "isActive"
       FROM "company_groups" WHERE "groupCode" = $1`,
    [source.group.groupCode],
  );
  if (groupResult.rows.length > 1)
    throw new Error('Duplicate target Company Group code.');
  const group = groupResult.rows[0]
    ? toCompanyGroup(groupResult.rows[0])
    : null;
  const companyResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "companyGroupId", "companyCode", "companyName", "registrationNo",
            "taxNumber", "legal_country_code" AS "legalCountryCode", "parentCompanyId", "isActive"
       FROM "companies" WHERE "companyCode" = $1`,
    [source.company.companyCode],
  );
  if (companyResult.rows.length > 1)
    throw new Error('Duplicate target Company code.');
  const company = companyResult.rows[0]
    ? toCompany(companyResult.rows[0])
    : null;
  const branchResult = await client.query<Record<string, unknown>>(
    `SELECT branch."id", branch."companyId", branch."branchCode", branch."branchName",
            branch."addressLine1", branch."addressLine2", branch."city", branch."state",
            branch."postalCode", branch."countryCode", branch."timezone",
            branch."countrySubdivisionCode", branch."isActive"
       FROM "branches" AS branch
       JOIN "companies" AS company ON company."id" = branch."companyId"
      WHERE company."companyCode" = $1 AND branch."branchCode" = $2`,
    [source.company.companyCode, source.branch.branchCode],
  );
  if (branchResult.rows.length > 1)
    throw new Error('Duplicate target Branch code.');
  const branch = branchResult.rows[0] ? toBranch(branchResult.rows[0]) : null;
  const departmentResult = await client.query<Record<string, unknown>>(
    `SELECT department."id", department."companyId", department."branchId",
            department."departmentCode", department."departmentName", department."isActive"
       FROM "departments" AS department
       JOIN "branches" AS branch ON branch."id" = department."branchId"
       JOIN "companies" AS company ON company."id" = department."companyId"
      WHERE company."companyCode" = $1
        AND branch."branchCode" = $2
        AND department."departmentCode" = $3`,
    [
      source.company.companyCode,
      source.branch.branchCode,
      source.department.departmentCode,
    ],
  );
  if (departmentResult.rows.length > 1)
    throw new Error('Duplicate target Department code.');
  const department = departmentResult.rows[0]
    ? toDepartment(departmentResult.rows[0])
    : null;
  const designationCodes = source.designations.map(
    (designation) => designation.designationCode,
  );
  const designationResult = await client.query<Record<string, unknown>>(
    `SELECT designation."id", designation."companyId", designation."departmentId",
            designation."designationCode", designation."designationName", designation."level",
            designation."isActive"
       FROM "designations" AS designation
       JOIN "companies" AS company ON company."id" = designation."companyId"
      WHERE company."companyCode" = $1
        AND designation."designationCode" = ANY($2::text[])`,
    [source.company.companyCode, designationCodes],
  );
  const employeeCodes = source.employees.map(
    (employee) => employee.employeeCode,
  );
  const employeeResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "employeeCode", "companyId", "branchId", "departmentId",
            "firstName", "lastName", "email", "mobile", "designationId",
            "joiningDate", "employeeType", "employmentStatus",
            "creationSource"::text AS "creationSource", "sourceCandidateId",
            "isActive", "managerId"
       FROM "employees"
      WHERE "employeeCode" = ANY($1::text[])`,
    [employeeCodes],
  );
  const employees = employeeResult.rows.map(toEmployee);
  const targetEmployeeIds = employees.map((employee) => employee.id);
  const userResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "username", "normalizedUsername", "displayName", "email",
            "normalizedEmail", "emailVerifiedAt", "status"::text AS "status",
            "mustChangePassword", "failedLoginAttempts", "lockedUntil", "employeeId", "defaultCompanyGroupId",
            "defaultCompanyId", "defaultBranchId",
            (NULLIF(BTRIM("passwordHash"), '') IS NOT NULL) AS "passwordHashPresent"
       FROM "users"
      WHERE LOWER(BTRIM("normalizedEmail")) = ANY($1::text[])
         OR LOWER(BTRIM("email")) = ANY($1::text[])
         OR LOWER(BTRIM("normalizedUsername")) = ANY($2::text[])
         OR LOWER(BTRIM("username")) = ANY($2::text[])
         OR "employeeId" = ANY($3::text[])`,
    [
      [...PRODFIX_WORKSHEET_PERSONA_EMAILS],
      PRODFIX_WORKSHEET_PERSONA_CONTRACT.map((persona) => persona.username),
      targetEmployeeIds,
    ],
  );
  const users = userResult.rows.map((row) => {
    const user = toTargetUser(row);
    const exactEmail = normalize(user.normalizedEmail);
    return PRODFIX_WORKSHEET_PERSONA_EMAILS.includes(exactEmail as never)
      ? {
          ...user,
          passwordHashPresent: Boolean(
            targetCredentialHashes.get(exactEmail)?.trim(),
          ),
        }
      : user;
  });
  const roleCodes = allowedRoleCodes();
  const roleResult = await client.query<Record<string, unknown>>(
    `SELECT "id", "code", "name", "description", "isSystem", "isActive", "companyGroupId"
       FROM "roles" WHERE "code" = ANY($1::text[])`,
    [roleCodes],
  );
  const roles = roleResult.rows.map(toRole);
  const targetRolePermissionResult = roles.length
    ? await client.query<Record<string, unknown>>(
        `SELECT mapping."roleId", permission."code" AS "permissionCode"
           FROM "role_permissions" AS mapping
           JOIN "permissions" AS permission ON permission."id" = mapping."permissionId"
          WHERE mapping."roleId" = ANY($1::text[])`,
        [roles.map((role) => role.id)],
      )
    : { rows: [] as Record<string, unknown>[] };
  const exactTargetUserIds = users
    .filter((user) =>
      PRODFIX_WORKSHEET_PERSONA_EMAILS.includes(
        normalize(user.normalizedEmail) as never,
      ),
    )
    .map((user) => user.id);
  const assignmentResult = exactTargetUserIds.length
    ? await client.query<Record<string, unknown>>(
        `SELECT assignment."userId", assignment."roleId", assignment."scope"::text AS "scope",
                assignment."scopeKey", assignment."companyGroupId", assignment."companyId",
                assignment."branchId", assignment."isActive",
                user_record."normalizedEmail" AS "userNormalizedEmail",
                role."code" AS "roleCode"
           FROM "user_role_assignments" AS assignment
           JOIN "users" AS user_record ON user_record."id" = assignment."userId"
           JOIN "roles" AS role ON role."id" = assignment."roleId"
          WHERE assignment."userId" = ANY($1::text[])`,
        [exactTargetUserIds],
      )
    : { rows: [] as Record<string, unknown>[] };
  const requiredModules = PRODFIX_WORKSHEET_PERSONA_STAGING_MODULE_CODES;
  const entitlementResult =
    company && requiredModules.length
      ? await client.query<Record<string, unknown>>(
          `SELECT "id", "companyId", "module"::text AS "module", "isEnabled"
           FROM "company_module_entitlements"
          WHERE "companyId" = $1 AND "module"::text = ANY($2::text[])`,
          [company.id, requiredModules],
        )
      : { rows: [] as Record<string, unknown>[] };
  const onboardingResult = group
    ? await client.query<Record<string, unknown>>(
        `SELECT "id", "companyGroupId", "ownerUserId", "status"::text AS "status",
                "currentStep"::text AS "currentStep", "completedAt"
           FROM "organization_onboardings" WHERE "companyGroupId" = $1`,
        [group.id],
      )
    : { rows: [] as Record<string, unknown>[] };
  if (onboardingResult.rows.length > 1)
    throw new Error('Duplicate target OrganizationOnboarding context.');
  const grantResult = exactTargetUserIds.length
    ? await client.query<Record<string, unknown>>(
        `SELECT "id", "companyId", "branchId", "departmentId", "userId",
                "grantedByUserId", "revokedAt", "revokedByUserId"
           FROM "department_asset_grants"
          WHERE "userId" = ANY($1::text[])`,
        [exactTargetUserIds],
      )
    : { rows: [] as Record<string, unknown>[] };
  const activeSessionResult = exactTargetUserIds.length
    ? await client.query<{ userId: string }>(
        `SELECT DISTINCT "userId"
           FROM "auth_sessions"
          WHERE "userId" = ANY($1::text[])
            AND "revokedAt" IS NULL
            AND "idleExpiresAt" > CURRENT_TIMESTAMP
            AND "absoluteExpiresAt" > CURRENT_TIMESTAMP`,
        [exactTargetUserIds],
      )
    : { rows: [] as { userId: string }[] };
  return {
    group,
    company,
    branch,
    department,
    designations: designationResult.rows.map(toDesignation),
    employees,
    users,
    roles,
    assignments:
      assignmentResult.rows as unknown as TargetRoleAssignmentRecord[],
    rolePermissions:
      targetRolePermissionResult.rows as unknown as TargetRolePermission[],
    entitlements:
      entitlementResult.rows as unknown as ModuleEntitlementRecord[],
    onboarding: (onboardingResult.rows[0] ??
      null) as OrganizationOnboardingRecord | null,
    departmentAssetGrants:
      grantResult.rows as unknown as DepartmentAssetGrantRecord[],
    credentialHashCommitment:
      credentialMode === 'PRESERVE_SOURCE_HASHES'
        ? credentialHashCommitmentForProdfixWorksheetPersonas(
            'target',
            targetCredentialHashes,
          )
        : null,
    activeSessionUserIds: activeSessionResult.rows
      .map((session) => session.userId)
      .sort(),
  };
}

function assertFreshStagingPassword(environment: Environment): string {
  const value = requiredEnvironment(
    environment,
    'QA_PRODFIX_WORKSHEET_PERSONA_PASSWORD',
  );
  if (value.length < 12 || value.length > 128) {
    throw new Error(
      'QA_PRODFIX_WORKSHEET_PERSONA_PASSWORD must be 12-128 characters; its value is never printed.',
    );
  }
  return value;
}

function sameHash(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8');
  const rightBytes = Buffer.from(right, 'utf8');
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

async function assertUsableArgon2Hash(
  value: string,
  label: string,
): Promise<void> {
  if (value !== value.trim() || !/^\$argon2(?:id|i|d)\$/.test(value)) {
    throw new Error(`${label} has no usable Argon2 credential hash.`);
  }
  try {
    await verifyArgon2(value, CREDENTIAL_VALIDATION_PROBE);
  } catch {
    throw new Error(`${label} has no usable Argon2 credential hash.`);
  }
}

async function readExactSourceCredentialHashes(
  client: pg.Client,
): Promise<Map<string, string>> {
  const result = await client.query<{
    normalizedEmail: string;
    passwordHash: string | null;
  }>(
    `SELECT "normalizedEmail", "passwordHash"
       FROM "users"
      WHERE "normalizedEmail" = ANY($1::text[])`,
    [[...PRODFIX_WORKSHEET_PERSONA_EMAILS]],
  );
  if (result.rows.length !== PRODFIX_WORKSHEET_PERSONA_EMAILS.length) {
    throw new Error(
      'The exact four source credential hashes could not be resolved.',
    );
  }
  const hashes = new Map<string, string>();
  for (const row of result.rows) {
    if (
      !PRODFIX_WORKSHEET_PERSONA_EMAILS.includes(
        row.normalizedEmail as never,
      ) ||
      !row.passwordHash
    ) {
      throw new Error(
        'An exact source worksheet persona has no usable credential hash.',
      );
    }
    await assertUsableArgon2Hash(
      row.passwordHash,
      'An exact source worksheet persona',
    );
    hashes.set(row.normalizedEmail, row.passwordHash);
  }
  if (hashes.size !== PRODFIX_WORKSHEET_PERSONA_EMAILS.length) {
    throw new Error(
      'The exact source credential query did not return one hash per approved persona.',
    );
  }
  return hashes;
}

async function readExactTargetCredentialHashes(
  client: pg.Client,
): Promise<Map<string, string | null>> {
  const result = await client.query<{
    normalizedEmail: string;
    passwordHash: string | null;
  }>(
    `SELECT "normalizedEmail", "passwordHash"
       FROM "users"
      WHERE LOWER(BTRIM("normalizedEmail")) = ANY($1::text[])`,
    [[...PRODFIX_WORKSHEET_PERSONA_EMAILS]],
  );
  const hashes = new Map<string, string | null>();
  for (const row of result.rows) {
    const email = normalize(row.normalizedEmail);
    if (!PRODFIX_WORKSHEET_PERSONA_EMAILS.includes(email as never)) {
      throw new Error(
        'The target credential reader escaped the exact four-persona closure.',
      );
    }
    if (hashes.has(email)) {
      throw new Error(
        'Multiple target credential rows match an approved persona.',
      );
    }
    if (row.passwordHash !== null) {
      await assertUsableArgon2Hash(row.passwordHash, `Target user ${email}`);
    }
    hashes.set(email, row.passwordHash);
  }
  return hashes;
}

function assertExistingTargetCredentialHashes(
  prepared: PreparedProdfixWorksheetPersonaImport,
  sourceHashes: ReadonlyMap<string, string>,
  targetHashes: ReadonlyMap<string, string | null>,
): void {
  const existingEmails = prepared.target.users
    .map((user) => user.normalizedEmail)
    .map(normalize)
    .filter((email) =>
      PRODFIX_WORKSHEET_PERSONA_EMAILS.includes(email as never),
    );
  for (const email of existingEmails) {
    const sourceHash = sourceHashes.get(email);
    const targetHash = targetHashes.get(email);
    if (!sourceHash || !targetHash || !sameHash(sourceHash, targetHash)) {
      throw new Error(
        `The staged credential for ${email} diverges; credential hashes are never reset or rotated.`,
      );
    }
  }
}

async function assertExistingTargetCredentialsMatchFreshPassword(
  prepared: PreparedProdfixWorksheetPersonaImport,
  targetHashes: ReadonlyMap<string, string | null>,
  freshPassword: string,
): Promise<void> {
  const existingEmails = prepared.target.users
    .map((user) => normalize(user.normalizedEmail))
    .filter((email) =>
      PRODFIX_WORKSHEET_PERSONA_EMAILS.includes(email as never),
    );
  for (const email of existingEmails) {
    const targetHash = targetHashes.get(email);
    if (!targetHash || !(await verifyArgon2(targetHash, freshPassword))) {
      throw new Error(
        `The staged credential for ${email} does not match the supplied fresh staging password; it will not be reset.`,
      );
    }
  }
}

async function insertCompanyGroup(
  client: pg.Client,
  source: CompanyGroupRecord,
): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "company_groups" ("id", "groupCode", "groupName", "description", "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
    [
      id,
      source.groupCode,
      source.groupName,
      source.description,
      source.isActive,
    ],
  );
  return id;
}

async function insertCompany(
  client: pg.Client,
  source: CompanyRecord,
  groupId: string,
): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "companies" ("id", "companyGroupId", "companyCode", "companyName", "registrationNo", "taxNumber", "legal_country_code", "parentCompanyId", "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, CURRENT_TIMESTAMP)`,
    [
      id,
      groupId,
      source.companyCode,
      source.companyName,
      source.registrationNo,
      source.taxNumber,
      source.legalCountryCode,
      source.isActive,
    ],
  );
  return id;
}

async function insertBranch(
  client: pg.Client,
  source: BranchRecord,
  companyId: string,
): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "branches" ("id", "companyId", "branchCode", "branchName", "addressLine1", "addressLine2", "city", "state", "postalCode", "countryCode", "timezone", "countrySubdivisionCode", "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)`,
    [
      id,
      companyId,
      source.branchCode,
      source.branchName,
      source.addressLine1,
      source.addressLine2,
      source.city,
      source.state,
      source.postalCode,
      source.countryCode,
      source.timezone,
      source.countrySubdivisionCode,
      source.isActive,
    ],
  );
  return id;
}

async function insertDepartment(
  client: pg.Client,
  source: DepartmentRecord,
  companyId: string,
  branchId: string,
): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "departments" ("id", "companyId", "branchId", "departmentCode", "departmentName", "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
    [
      id,
      companyId,
      branchId,
      source.departmentCode,
      source.departmentName,
      source.isActive,
    ],
  );
  return id;
}

async function insertDesignation(
  client: pg.Client,
  source: DesignationRecord,
  companyId: string,
  departmentId: string,
): Promise<string> {
  const id = randomUUID();
  await client.query(
    `INSERT INTO "designations" ("id", "companyId", "departmentId", "designationCode", "designationName", "level", "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
    [
      id,
      companyId,
      source.departmentId === null ? null : departmentId,
      source.designationCode,
      source.designationName,
      source.level,
      source.isActive,
    ],
  );
  return id;
}

async function applyPreparedImport(
  client: pg.Client,
  prepared: PreparedProdfixWorksheetPersonaImport,
  preservedHashes: ReadonlyMap<string, string> | null,
  freshPassword: string | null,
): Promise<CreatedRecordCounts> {
  const source = prepared.source;
  const target = prepared.target;
  const created = {
    companyGroups: 0,
    companies: 0,
    branches: 0,
    departments: 0,
    designations: 0,
    employees: 0,
    users: 0,
    roleAssignments: 0,
    moduleEntitlements: 0,
    organizationOnboardings: 0,
    departmentAssetGrants: 0,
  };
  const groupId =
    target.group?.id ?? (await insertCompanyGroup(client, source.group));
  if (!target.group) created.companyGroups += 1;
  const companyId =
    target.company?.id ??
    (await insertCompany(client, source.company, groupId));
  if (!target.company) created.companies += 1;
  const branchId =
    target.branch?.id ?? (await insertBranch(client, source.branch, companyId));
  if (!target.branch) created.branches += 1;
  const departmentId =
    target.department?.id ??
    (await insertDepartment(client, source.department, companyId, branchId));
  if (!target.department) created.departments += 1;

  const designationIds = new Map(
    target.designations.map((designation) => [
      designation.designationCode,
      designation.id,
    ]),
  );
  for (const designation of source.designations) {
    if (!designationIds.has(designation.designationCode)) {
      designationIds.set(
        designation.designationCode,
        await insertDesignation(client, designation, companyId, departmentId),
      );
      created.designations += 1;
    }
  }
  const employeeIds = new Map(
    target.employees.map((employee) => [employee.employeeCode, employee.id]),
  );
  for (const employee of prepared.employeeInsertOrder) {
    if (employeeIds.has(employee.employeeCode)) continue;
    const managerEmployeeCode = employee.managerId
      ? source.employees.find(
          (candidate) => candidate.id === employee.managerId,
        )?.employeeCode
      : null;
    const managerId = managerEmployeeCode
      ? employeeIds.get(managerEmployeeCode)
      : null;
    if (managerEmployeeCode && !managerId)
      throw new Error('The manager was not inserted before its report.');
    const designationId = employee.designationId
      ? designationIds.get(
          source.designations.find(
            (designation) => designation.id === employee.designationId,
          )?.designationCode ?? '',
        )
      : null;
    if (employee.designationId && !designationId)
      throw new Error(
        'The Employee Designation is missing from the bounded target closure.',
      );
    const id = randomUUID();
    await client.query(
      `INSERT INTO "employees" ("id", "employeeCode", "companyId", "branchId", "departmentId", "firstName", "lastName", "email", "mobile", "designationId", "joiningDate", "employeeType", "employmentStatus", "creationSource", "isActive", "managerId", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'MANUAL', $14, $15, CURRENT_TIMESTAMP)`,
      [
        id,
        employee.employeeCode,
        companyId,
        branchId,
        departmentId,
        employee.firstName,
        employee.lastName,
        employee.email,
        employee.mobile,
        designationId,
        employee.joiningDate,
        employee.employeeType,
        employee.employmentStatus,
        employee.isActive,
        managerId,
      ],
    );
    employeeIds.set(employee.employeeCode, id);
    created.employees += 1;
  }

  const userIds = new Map(
    target.users
      .filter((user) =>
        PRODFIX_WORKSHEET_PERSONA_EMAILS.includes(
          user.normalizedEmail as never,
        ),
      )
      .map((user) => [user.normalizedEmail, user.id]),
  );
  const usersToCreate = source.users.filter(
    (user) => !userIds.has(user.normalizedEmail),
  );
  for (const user of usersToCreate) {
    const sourceEmployee = source.employees.find(
      (employee) => employee.id === user.employeeId,
    );
    const employeeId = sourceEmployee
      ? employeeIds.get(sourceEmployee.employeeCode)
      : null;
    const passwordHash = preservedHashes
      ? preservedHashes.get(user.normalizedEmail)
      : freshPassword
        ? await hash(freshPassword, {
            type: 2,
            memoryCost: 19_456,
            timeCost: 2,
            parallelism: 1,
          })
        : null;
    if (!employeeId || !passwordHash)
      throw new Error(
        'A new worksheet persona cannot be created without its bounded Employee and credential.',
      );
    const id = randomUUID();
    await client.query(
      `INSERT INTO "users" ("id", "username", "normalizedUsername", "displayName", "email", "normalizedEmail", "emailVerifiedAt", "passwordHash", "status", "mustChangePassword", "failedLoginAttempts", "lockedUntil", "employeeId", "defaultCompanyGroupId", "defaultCompanyId", "defaultBranchId", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::"UserStatus", $10, 0, NULL, $11, $12, $13, $14, CURRENT_TIMESTAMP)`,
      [
        id,
        user.username,
        user.normalizedUsername,
        user.displayName,
        user.email,
        user.normalizedEmail,
        user.emailVerifiedAt,
        passwordHash,
        user.status,
        user.mustChangePassword,
        employeeId,
        user.defaultCompanyGroupId === null ? null : groupId,
        user.defaultCompanyId === null ? null : companyId,
        user.defaultBranchId === null ? null : branchId,
      ],
    );
    userIds.set(user.normalizedEmail, id);
    created.users += 1;
  }

  if (prepared.plan.actions.organizationOnboarding.action === 'CREATE') {
    const ownerId = userIds.get('prodfix.owner.20260917@example.test');
    if (!ownerId)
      throw new Error(
        'The bounded owner User is unavailable for OrganizationOnboarding.',
      );
    await client.query(
      `INSERT INTO "organization_onboardings" ("id", "companyGroupId", "ownerUserId", "status", "currentStep", "completedAt", "updatedAt")
       VALUES ($1, $2, $3, 'COMPLETED', 'COMPLETED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [randomUUID(), groupId, ownerId],
    );
    created.organizationOnboardings += 1;
  }

  const roleIds = new Map(target.roles.map((role) => [role.code, role.id]));
  for (const action of prepared.plan.actions.roleAssignments) {
    if (action.action === 'NOOP') continue;
    const userId = userIds.get(action.email);
    const roleId = roleIds.get(action.roleCode);
    if (!userId || !roleId)
      throw new Error(
        'A bounded user or pre-existing Role is unavailable for an assignment.',
      );
    const scopeKey =
      action.scope === 'COMPANY_GROUP'
        ? `COMPANY_GROUP:${groupId}`
        : action.scope === 'COMPANY'
          ? `COMPANY:${companyId}`
          : `BRANCH:${branchId}`;
    await client.query(
      `INSERT INTO "user_role_assignments" ("id", "userId", "roleId", "scope", "scopeKey", "companyGroupId", "companyId", "branchId", "isActive", "updatedAt")
       VALUES ($1, $2, $3, $4::"RoleScope", $5, $6, $7, $8, TRUE, CURRENT_TIMESTAMP)`,
      [
        randomUUID(),
        userId,
        roleId,
        action.scope,
        scopeKey,
        action.scope === 'COMPANY_GROUP' ? groupId : null,
        action.scope === 'COMPANY_GROUP' ? null : companyId,
        action.scope === 'BRANCH' ? branchId : null,
      ],
    );
    created.roleAssignments += 1;
  }

  for (const action of prepared.plan.actions.moduleEntitlements) {
    if (action.action === 'NOOP') continue;
    const existing = await client.query<{ isEnabled: boolean }>(
      `SELECT "isEnabled" FROM "company_module_entitlements"
        WHERE "companyId" = $1 AND "module"::text = $2`,
      [companyId, action.module],
    );
    if (existing.rows[0]?.isEnabled) continue;
    if (existing.rows[0] && !existing.rows[0].isEnabled) {
      throw new Error(
        `Module entitlement ${action.module} became disabled during apply.`,
      );
    }
    await client.query(
      `INSERT INTO "company_module_entitlements" ("id", "companyId", "module", "isEnabled", "updatedAt")
       VALUES ($1, $2, $3::"CompanyModuleCode", TRUE, CURRENT_TIMESTAMP)`,
      [randomUUID(), companyId, action.module],
    );
    created.moduleEntitlements += 1;
  }

  if (prepared.plan.actions.departmentAssetGrant.action === 'CREATE') {
    const managerId = userIds.get('prodfix.mgr.20260917@example.test');
    const ownerId = userIds.get('prodfix.owner.20260917@example.test');
    if (!managerId || !ownerId)
      throw new Error(
        'The manager or owner User is unavailable for the exact Department Asset Grant.',
      );
    await client.query(
      `INSERT INTO "department_asset_grants" ("id", "companyId", "branchId", "departmentId", "userId", "grantedByUserId", "grantedAt", "revokedAt", "revokedByUserId", "version", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, NULL, NULL, 1, CURRENT_TIMESTAMP)`,
      [randomUUID(), companyId, branchId, departmentId, managerId, ownerId],
    );
    created.departmentAssetGrants += 1;
  }
  return created;
}

type CreatedRecordCounts = Readonly<{
  companyGroups: number;
  companies: number;
  branches: number;
  departments: number;
  designations: number;
  employees: number;
  users: number;
  roleAssignments: number;
  moduleEntitlements: number;
  organizationOnboardings: number;
  departmentAssetGrants: number;
}>;

function assertPostCommitPlanIsNoop(
  prepared: PreparedProdfixWorksheetPersonaImport,
): void {
  const actions = prepared.plan.actions;
  const actionValues = [
    actions.companyGroup.action,
    actions.company.action,
    actions.branch.action,
    actions.department.action,
    ...actions.designations.map((action) => action.action),
    ...actions.employees.map((action) => action.action),
    ...actions.users.map((action) => action.action),
    ...actions.roleAssignments.map((action) => action.action),
    ...actions.moduleEntitlements.map((action) => action.action),
    actions.organizationOnboarding.action,
    actions.departmentAssetGrant.action,
  ];
  if (actionValues.some((action) => action !== 'NOOP')) {
    throw new Error(
      'Post-commit staging verification found a non-noop bounded import plan.',
    );
  }
  if (
    actions.users.length !== PRODFIX_WORKSHEET_PERSONA_EMAILS.length ||
    actions.roleAssignments.length !== 5 ||
    actions.organizationOnboarding.action !== 'NOOP' ||
    actions.departmentAssetGrant.action !== 'NOOP' ||
    prepared.target.departmentAssetGrants.length !== 1 ||
    prepared.target.activeSessionUserIds.length !== 0
  ) {
    throw new Error(
      'Post-commit staging verification did not find the exact bounded persona context.',
    );
  }
  for (const email of PRODFIX_WORKSHEET_PERSONA_EMAILS) {
    const user = prepared.target.users.find(
      (candidate) => normalize(candidate.normalizedEmail) === email,
    );
    if (!user || !user.passwordHashPresent) {
      throw new Error(
        'Post-commit staging verification found a missing or unusable persona credential.',
      );
    }
  }
}

async function assertAllTargetCredentialsMatchFreshPassword(
  client: pg.Client,
  freshPassword: string,
): Promise<void> {
  const targetHashes = await readExactTargetCredentialHashes(client);
  if (targetHashes.size !== PRODFIX_WORKSHEET_PERSONA_EMAILS.length) {
    throw new Error(
      'Post-commit staging verification did not find four exact persona credentials.',
    );
  }
  for (const email of PRODFIX_WORKSHEET_PERSONA_EMAILS) {
    const targetHash = targetHashes.get(email);
    if (!targetHash || !(await verifyArgon2(targetHash, freshPassword))) {
      throw new Error('Post-commit staging credential verification failed.');
    }
  }
}

function writePostCommitEvidence(
  preparedBeforeApply: PreparedProdfixWorksheetPersonaImport,
  preparedAfterApply: PreparedProdfixWorksheetPersonaImport,
  schemaFingerprint: string,
  created: CreatedRecordCounts,
): string {
  const evidenceDirectory = resolve(process.cwd(), '.qa-runs');
  mkdirSync(evidenceDirectory, { recursive: true });
  const evidencePath = resolve(
    evidenceDirectory,
    `prodfix-worksheet-persona-import-${Date.now()}-${randomUUID()}.json`,
  );
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        status: 'POST_COMMIT_VERIFIED',
        format: preparedBeforeApply.plan.format,
        reviewedPlanDigest: preparedBeforeApply.plan.planDigest,
        sourceDigest: preparedBeforeApply.plan.sourceDigest,
        initialTargetFingerprint: preparedBeforeApply.plan.targetFingerprint,
        postCommitTargetFingerprint: preparedAfterApply.plan.targetFingerprint,
        schemaFingerprint,
        created,
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8', flag: 'wx' },
  );
  return evidencePath;
}

function writeCommittedUnverifiedEvidence(
  prepared: PreparedProdfixWorksheetPersonaImport,
  schemaFingerprintBeforeApply: string,
  created: CreatedRecordCounts,
): string | null {
  try {
    const evidenceDirectory = resolve(process.cwd(), '.qa-runs');
    mkdirSync(evidenceDirectory, { recursive: true });
    const evidencePath = resolve(
      evidenceDirectory,
      `prodfix-worksheet-persona-import-${Date.now()}-${randomUUID()}-unverified.json`,
    );
    writeFileSync(
      evidencePath,
      `${JSON.stringify(
        {
          status: 'COMMITTED_UNVERIFIED',
          format: prepared.plan.format,
          reviewedPlanDigest: prepared.plan.planDigest,
          sourceDigest: prepared.plan.sourceDigest,
          initialTargetFingerprint: prepared.plan.targetFingerprint,
          schemaFingerprintBeforeApply,
          created,
          recovery:
            'Do not retry apply. Perform the bounded read-only post-commit verification before any further change.',
        },
        null,
        2,
      )}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    return evidencePath;
  } catch {
    return null;
  }
}

async function verifyPostCommitStagingState(
  target: QaWriteTarget,
  environment: Environment,
  source: ProdfixWorksheetSourceSnapshot,
  invocation: ProdfixWorksheetPersonaImportInvocation,
  preparedBeforeApply: PreparedProdfixWorksheetPersonaImport,
  schemaFingerprintBeforeApply: string,
  created: CreatedRecordCounts,
  preservedHashes: ReadonlyMap<string, string> | null,
  freshPassword: string | null,
): Promise<string> {
  const verificationClient = createTargetClient(target, environment);
  try {
    await verificationClient.connect();
    await beginTargetSnapshot(verificationClient, target, true);
    const schemaFingerprintAfterApply = await readQaSchemaFingerprint(
      asRawQueryClient(verificationClient),
    );
    if (schemaFingerprintAfterApply !== schemaFingerprintBeforeApply) {
      throw new Error(
        'The staging schema fingerprint changed during the bounded import.',
      );
    }
    const targetSnapshotAfterApply = await readTargetSnapshot(
      verificationClient,
      source,
      invocation.credentialMode,
    );
    const preparedAfterApply = prepareProdfixWorksheetPersonaImport(
      source,
      targetSnapshotAfterApply,
      invocation,
    );
    assertPostCommitPlanIsNoop(preparedAfterApply);
    if (preservedHashes) {
      assertExistingTargetCredentialHashes(
        preparedAfterApply,
        preservedHashes,
        await readExactTargetCredentialHashes(verificationClient),
      );
    } else if (freshPassword) {
      await assertAllTargetCredentialsMatchFreshPassword(
        verificationClient,
        freshPassword,
      );
    } else {
      throw new Error(
        'Post-commit staging verification has no authorized credential mode.',
      );
    }
    await verificationClient.query('COMMIT');
    return writePostCommitEvidence(
      preparedBeforeApply,
      preparedAfterApply,
      schemaFingerprintAfterApply,
      created,
    );
  } catch (error) {
    try {
      await verificationClient.query('ROLLBACK');
    } catch {
      /* no verification transaction opened */
    }
    throw error;
  } finally {
    await verificationClient.end();
  }
}

async function main(): Promise<void> {
  const invocation = parseProdfixWorksheetPersonaImportArguments(
    process.argv.slice(2),
  );
  resolveProdfixWorksheetPersonaSelectors(process.env);
  const environment = process.env;
  const target =
    invocation.mode === 'APPLY'
      ? assertQaWriteEnvironment(SCRIPT_NAME, environment)
      : assertPlanTargetEnvironment(environment);
  if (invocation.mode === 'APPLY') {
    assertProdfixWorksheetPersonaApplyConfirmations(invocation, environment);
  }
  const sourceClient = createSourceClient(target, environment);
  const targetClient = createTargetClient(target, environment);
  let targetTransactionOpen = false;
  try {
    await targetClient.connect();
    await beginTargetSnapshot(
      targetClient,
      target,
      invocation.mode === 'PLAN_ONLY',
    );
    targetTransactionOpen = true;
    const schemaFingerprintBeforeApply = await readQaSchemaFingerprint(
      asRawQueryClient(targetClient),
    );
    // Source credentials are never read until this independently connected
    // target has passed the guarded staging-sentinel attestation.
    await sourceClient.connect();
    await beginSourceSnapshot(sourceClient);
    const source = await readSourceSnapshot(
      sourceClient,
      invocation.credentialMode,
    );
    const targetSnapshot = await readTargetSnapshot(
      targetClient,
      source,
      invocation.credentialMode,
    );
    const prepared = prepareProdfixWorksheetPersonaImport(
      source,
      targetSnapshot,
      invocation,
    );
    if (invocation.mode === 'PLAN_ONLY') {
      await targetClient.query('COMMIT');
      targetTransactionOpen = false;
      console.log(JSON.stringify(prepared.plan, null, 2));
      return;
    }
    if (prepared.plan.planDigest !== invocation.reviewedPlanDigest) {
      throw new Error(
        'The source or target fingerprint changed since review; apply is refused.',
      );
    }
    const preservedHashes =
      invocation.credentialMode === 'PRESERVE_SOURCE_HASHES'
        ? await readExactSourceCredentialHashes(sourceClient)
        : null;
    if (preservedHashes) {
      if (
        credentialHashCommitmentForProdfixWorksheetPersonas(
          'source',
          preservedHashes,
        ) !== prepared.source.credentialHashCommitment
      ) {
        throw new Error(
          'The source credential commitment changed since the reviewed plan.',
        );
      }
      const targetHashes = await readExactTargetCredentialHashes(targetClient);
      if (
        credentialHashCommitmentForProdfixWorksheetPersonas(
          'target',
          targetHashes,
        ) !== prepared.target.credentialHashCommitment
      ) {
        throw new Error(
          'The target credential commitment changed since the reviewed plan.',
        );
      }
      assertExistingTargetCredentialHashes(
        prepared,
        preservedHashes,
        targetHashes,
      );
    }
    const freshPassword =
      invocation.credentialMode === 'FRESH_STAGING_PASSWORD_FOR_NEW_USERS'
        ? assertFreshStagingPassword(environment)
        : null;
    if (freshPassword) {
      await assertExistingTargetCredentialsMatchFreshPassword(
        prepared,
        await readExactTargetCredentialHashes(targetClient),
        freshPassword,
      );
    }
    const created = await applyPreparedImport(
      targetClient,
      prepared,
      preservedHashes,
      freshPassword,
    );
    await targetClient.query('COMMIT');
    targetTransactionOpen = false;
    let evidencePath: string;
    try {
      evidencePath = await verifyPostCommitStagingState(
        target,
        environment,
        source,
        invocation,
        prepared,
        schemaFingerprintBeforeApply,
        created,
        preservedHashes,
        freshPassword,
      );
    } catch {
      const recoveryEvidencePath = writeCommittedUnverifiedEvidence(
        prepared,
        schemaFingerprintBeforeApply,
        created,
      );
      console.error(
        JSON.stringify(
          {
            status: 'COMMITTED_UNVERIFIED',
            reviewedPlanDigest: prepared.plan.planDigest,
            sourceDigest: prepared.plan.sourceDigest,
            created,
            evidencePath: recoveryEvidencePath,
            recovery:
              'The staging import already committed. Do not retry apply; perform bounded read-only verification first.',
          },
          null,
          2,
        ),
      );
      throw new Error(
        'The staging import already committed, but post-commit verification or evidence failed. Do not retry apply; perform bounded read-only verification first.',
      );
    }
    console.log(
      JSON.stringify(
        {
          status: 'PRODFIX_WORKSHEET_PERSONAS_IMPORTED',
          reviewedPlanDigest: prepared.plan.planDigest,
          sourceDigest: prepared.plan.sourceDigest,
          targetFingerprint: prepared.plan.targetFingerprint,
          credentialMode: prepared.plan.credentialHandling.mode,
          created,
          evidencePath,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (targetTransactionOpen) {
      try {
        await targetClient.query('ROLLBACK');
      } catch {
        /* target transaction could not be rolled back */
      }
    }
    throw error;
  } finally {
    try {
      await sourceClient.query('ROLLBACK');
    } catch {
      /* no source transaction opened */
    }
    await Promise.allSettled([sourceClient.end(), targetClient.end()]);
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
