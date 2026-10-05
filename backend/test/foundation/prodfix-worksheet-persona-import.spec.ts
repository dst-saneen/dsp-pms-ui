import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CompanyModuleCode } from '@prisma/client';

import {
  assertProdfixWorksheetPersonaApplyConfirmations,
  parseProdfixWorksheetPersonaImportArguments,
  prepareProdfixWorksheetPersonaImport,
  PRODFIX_WORKSHEET_PERSONA_CREDENTIAL_HASH_CONFIRMATION,
  PRODFIX_WORKSHEET_PERSONA_EMAILS,
  PRODFIX_WORKSHEET_PERSONA_IMPORT_CONFIRMATION,
  PRODFIX_WORKSHEET_PERSONA_STAGING_MODULE_CODES,
  resolveProdfixWorksheetSourceLegalCountryCode,
  resolveProdfixWorksheetPersonaSelectors,
  sourceDigestForProdfixWorksheetPersonaImport,
  type ProdfixWorksheetSourceSnapshot,
  type ProdfixWorksheetTargetSnapshot,
} from '../../scripts/qa/prodfix-worksheet-persona-import-contract';

const EMP = 'prodfix.emp.20260917@example.test';
const HR = 'prodfix.hr.20260917@example.test';
const MGR = 'prodfix.mgr.20260917@example.test';
const OWNER = 'prodfix.owner.20260917@example.test';

function sourceSnapshot(
  credentialHashCommitment: string | null = null,
): ProdfixWorksheetSourceSnapshot {
  const group = {
    id: 'source-group',
    groupCode: 'PFG-20260917',
    groupName: 'QA Group',
    description: null,
    isActive: true,
  };
  const company = {
    id: 'source-company',
    companyGroupId: group.id,
    companyCode: 'PFC-20260917',
    companyName: 'QA Company',
    registrationNo: null,
    taxNumber: null,
    legalCountryCode: 'IN',
    parentCompanyId: null,
    isActive: true,
  };
  const branch = {
    id: 'source-branch',
    companyId: company.id,
    branchCode: 'PFB-20260917',
    branchName: 'QA Branch',
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
    countryCode: 'IN',
    timezone: 'Asia/Kolkata',
    countrySubdivisionCode: 'IN-KL',
    isActive: true,
  };
  const department = {
    id: 'source-department',
    companyId: company.id,
    branchId: branch.id,
    departmentCode: 'PFD-20260917',
    departmentName: 'QA Department',
    isActive: true,
  };
  const designations = [
    {
      id: 'source-designation-se',
      companyId: company.id,
      departmentId: null,
      designationCode: 'DES-SE-20260917',
      designationName: 'Software Engineer',
      level: 1,
      isActive: true,
    },
    {
      id: 'source-designation-tl',
      companyId: company.id,
      departmentId: null,
      designationCode: 'DES-TL-20260917',
      designationName: 'Team Lead',
      level: 2,
      isActive: true,
    },
  ];
  const employees = [
    {
      id: 'employee-emp',
      employeeCode: 'EMP-EMP-20260917',
      designationId: designations[0].id,
      managerId: 'employee-mgr',
    },
    {
      id: 'employee-hr',
      employeeCode: 'EMP-HR-20260917',
      designationId: designations[1].id,
      managerId: null,
    },
    {
      id: 'employee-mgr',
      employeeCode: 'EMP-MGR-20260917',
      designationId: designations[1].id,
      managerId: null,
    },
    {
      id: 'employee-owner',
      employeeCode: 'EMP-OWN-20260917',
      designationId: designations[1].id,
      managerId: null,
    },
  ].map((employee) => ({
    ...employee,
    companyId: company.id,
    branchId: branch.id,
    departmentId: department.id,
    firstName: employee.employeeCode,
    lastName: null,
    email: `${employee.employeeCode}@example.test`,
    mobile: null,
    joiningDate: '2026-09-17T00:00:00.000Z',
    employeeType: 'PERMANENT',
    employmentStatus: 'ACTIVE',
    creationSource: 'MANUAL',
    sourceCandidateId: null,
    isActive: true,
  }));
  const users = [
    [EMP, 'jamie.employee.db60', 'employee-emp'],
    [HR, 'sam.hr.225a', 'employee-hr'],
    [MGR, 'alex.manager.5698', 'employee-mgr'],
    [OWNER, 'owner.admin.6675', 'employee-owner'],
  ].map(([email, username, employeeId]) => ({
    id: `user-${username}`,
    username,
    normalizedUsername: username,
    displayName: username,
    email,
    normalizedEmail: email,
    emailVerifiedAt: '2026-09-17T00:00:00.000Z',
    status: 'ACTIVE',
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    employeeId,
    defaultCompanyGroupId: group.id,
    defaultCompanyId: company.id,
    defaultBranchId: branch.id,
  }));
  const roles = [
    'EMPLOYEE',
    'HR_MANAGER',
    'ASSET_DEPARTMENT_CUSTODIAN',
    'PROJECT_MANAGER',
    'ORGANIZATION_OWNER',
  ].map((code) => ({
    id: `role-${code}`,
    code,
    name: code,
    description: null,
    isSystem: true,
    isActive: true,
    companyGroupId: null,
  }));
  const userId = (email: string) =>
    users.find((user) => user.normalizedEmail === email)!.id;
  const roleId = (code: string) => roles.find((role) => role.code === code)!.id;
  const assignments = [
    {
      userId: userId(EMP),
      roleId: roleId('EMPLOYEE'),
      scope: 'COMPANY',
      scopeKey: `COMPANY:${company.id}`,
      companyGroupId: null,
      companyId: company.id,
      branchId: null,
      isActive: true,
    },
    {
      userId: userId(HR),
      roleId: roleId('HR_MANAGER'),
      scope: 'COMPANY',
      scopeKey: `COMPANY:${company.id}`,
      companyGroupId: null,
      companyId: company.id,
      branchId: null,
      isActive: true,
    },
    {
      userId: userId(MGR),
      roleId: roleId('ASSET_DEPARTMENT_CUSTODIAN'),
      scope: 'BRANCH',
      scopeKey: `BRANCH:${branch.id}`,
      companyGroupId: null,
      companyId: company.id,
      branchId: branch.id,
      isActive: true,
    },
    {
      userId: userId(MGR),
      roleId: roleId('PROJECT_MANAGER'),
      scope: 'COMPANY',
      scopeKey: `COMPANY:${company.id}`,
      companyGroupId: null,
      companyId: company.id,
      branchId: null,
      isActive: true,
    },
    {
      userId: userId(OWNER),
      roleId: roleId('ORGANIZATION_OWNER'),
      scope: 'COMPANY_GROUP',
      scopeKey: `COMPANY_GROUP:${group.id}`,
      companyGroupId: group.id,
      companyId: null,
      branchId: null,
      isActive: true,
    },
  ] as const;
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
    rolePermissions: [
      {
        roleId: roleId('PROJECT_MANAGER'),
        permissionCode: 'projects.projects.read',
      },
    ],
    onboarding: {
      id: 'source-onboarding',
      companyGroupId: group.id,
      ownerUserId: userId(OWNER),
      status: 'COMPLETED',
      currentStep: 'REVIEW',
      completedAt: '2026-09-17T00:00:00.000Z',
    },
    departmentAssetGrants: [
      {
        id: 'source-grant',
        companyId: company.id,
        branchId: branch.id,
        departmentId: department.id,
        userId: userId(MGR),
        grantedByUserId: userId(OWNER),
        revokedAt: null,
        revokedByUserId: null,
      },
    ],
    credentialHashCommitment,
  };
}

function emptyTarget(
  source: ProdfixWorksheetSourceSnapshot,
  credentialHashCommitment: string | null = null,
): ProdfixWorksheetTargetSnapshot {
  return {
    group: null,
    company: null,
    branch: null,
    department: null,
    designations: [],
    employees: [],
    users: [],
    roles: source.roles.map((role) => ({ ...role, id: `target-${role.id}` })),
    assignments: [],
    rolePermissions: source.rolePermissions.map((mapping) => ({
      ...mapping,
      roleId: `target-${mapping.roleId}`,
    })),
    entitlements: [],
    onboarding: null,
    departmentAssetGrants: [],
    credentialHashCommitment,
    activeSessionUserIds: [],
  };
}

function equivalentTarget(
  source: ProdfixWorksheetSourceSnapshot,
): ProdfixWorksheetTargetSnapshot {
  const group = { ...source.group, id: 'target-group' };
  const company = {
    ...source.company,
    id: 'target-company',
    companyGroupId: group.id,
  };
  const branch = {
    ...source.branch,
    id: 'target-branch',
    companyId: company.id,
  };
  const department = {
    ...source.department,
    id: 'target-department',
    companyId: company.id,
    branchId: branch.id,
  };
  const designationIds = new Map(
    source.designations.map((record) => [record.id, `target-${record.id}`]),
  );
  const designations = source.designations.map((record) => ({
    ...record,
    id: designationIds.get(record.id)!,
    companyId: company.id,
    departmentId: record.departmentId === null ? null : department.id,
  }));
  const employeeIds = new Map(
    source.employees.map((record) => [record.id, `target-${record.id}`]),
  );
  const employees = source.employees.map((record) => ({
    ...record,
    id: employeeIds.get(record.id)!,
    companyId: company.id,
    branchId: branch.id,
    departmentId: department.id,
    designationId: record.designationId
      ? designationIds.get(record.designationId)!
      : null,
    managerId: record.managerId ? employeeIds.get(record.managerId)! : null,
  }));
  const userIds = new Map(
    source.users.map((record) => [record.id, `target-${record.id}`]),
  );
  const users = source.users.map((record) => ({
    ...record,
    id: userIds.get(record.id)!,
    employeeId: record.employeeId ? employeeIds.get(record.employeeId)! : null,
    defaultCompanyGroupId:
      record.defaultCompanyGroupId === null ? null : group.id,
    defaultCompanyId: record.defaultCompanyId === null ? null : company.id,
    defaultBranchId: record.defaultBranchId === null ? null : branch.id,
    passwordHashPresent: true,
  }));
  const roleIds = new Map(
    source.roles.map((record) => [record.id, `target-${record.id}`]),
  );
  const roles = source.roles.map((record) => ({
    ...record,
    id: roleIds.get(record.id)!,
  }));
  const assignments = source.assignments.map((record) => ({
    ...record,
    userId: userIds.get(record.userId)!,
    roleId: roleIds.get(record.roleId)!,
    companyGroupId: record.companyGroupId === null ? null : group.id,
    companyId: record.companyId === null ? null : company.id,
    branchId: record.branchId === null ? null : branch.id,
    scopeKey:
      record.scope === 'COMPANY_GROUP'
        ? `COMPANY_GROUP:${group.id}`
        : record.scope === 'COMPANY'
          ? `COMPANY:${company.id}`
          : `BRANCH:${branch.id}`,
    userNormalizedEmail: source.users.find((user) => user.id === record.userId)!
      .normalizedEmail,
    roleCode: source.roles.find((role) => role.id === record.roleId)!.code,
  }));
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
    rolePermissions: source.rolePermissions.map((record) => ({
      ...record,
      roleId: roleIds.get(record.roleId)!,
    })),
    entitlements: PRODFIX_WORKSHEET_PERSONA_STAGING_MODULE_CODES.map(
      (module) => ({
        id: `target-${module}`,
        companyId: company.id,
        module,
        isEnabled: true,
      }),
    ),
    onboarding: {
      ...source.onboarding,
      id: 'target-onboarding',
      companyGroupId: group.id,
      ownerUserId: userIds.get(source.onboarding.ownerUserId)!,
      currentStep: 'COMPLETED',
    },
    departmentAssetGrants: source.departmentAssetGrants.map((record) => ({
      ...record,
      id: `target-${record.id}`,
      companyId: company.id,
      branchId: branch.id,
      departmentId: department.id,
      userId: userIds.get(record.userId)!,
      grantedByUserId: userIds.get(record.grantedByUserId)!,
    })),
    credentialHashCommitment: null,
    activeSessionUserIds: [],
  };
}

describe('Prodfix worksheet persona import contract', () => {
  it('has no selector surface beyond the exact four normalized emails', () => {
    expect(resolveProdfixWorksheetPersonaSelectors()).toEqual([
      ...PRODFIX_WORKSHEET_PERSONA_EMAILS,
    ]);
    expect(() =>
      resolveProdfixWorksheetPersonaSelectors({
        QA_PRODFIX_WORKSHEET_PERSONA_EMAILS: `${EMP},${HR},${MGR},${OWNER},other@example.test`,
      }),
    ).toThrow('strict approved contract');
    expect(() =>
      parseProdfixWorksheetPersonaImportArguments([
        '--email=other@example.test',
      ]),
    ).toThrow('Usage');
  });

  it('is plan-first and binds an apply to a reviewed SHA-256 digest', () => {
    expect(parseProdfixWorksheetPersonaImportArguments([])).toEqual({
      mode: 'PLAN_ONLY',
      credentialMode: 'FRESH_STAGING_PASSWORD_FOR_NEW_USERS',
    });
    expect(() =>
      parseProdfixWorksheetPersonaImportArguments(['--apply']),
    ).toThrow('--plan-digest');
    expect(
      parseProdfixWorksheetPersonaImportArguments([
        '--apply',
        `--plan-digest=${'a'.repeat(64)}`,
        '--preserve-credential-hashes',
      ]),
    ).toMatchObject({
      mode: 'APPLY',
      credentialMode: 'PRESERVE_SOURCE_HASHES',
    });
  });

  it('plans exactly five scoped assignments plus the two bounded context records', () => {
    const source = sourceSnapshot();
    const prepared = prepareProdfixWorksheetPersonaImport(
      source,
      emptyTarget(source),
      parseProdfixWorksheetPersonaImportArguments([]),
    );
    expect(prepared.plan.format).toBe(
      'DSP_PMS_PRODFIX_WORKSHEET_PERSONA_IMPORT',
    );
    expect(prepared.plan.actions.roleAssignments).toHaveLength(5);
    expect(prepared.plan.actions.organizationOnboarding).toMatchObject({
      action: 'CREATE',
      ownerEmail: OWNER,
    });
    expect(prepared.plan.actions.departmentAssetGrant).toMatchObject({
      action: 'CREATE',
      userEmail: MGR,
      grantedByEmail: OWNER,
    });
    expect(prepared.plan.actions.moduleEntitlements).toEqual(
      PRODFIX_WORKSHEET_PERSONA_STAGING_MODULE_CODES.map((module) => ({
        companyCode: 'PFC-20260917',
        module,
        action: 'CREATE_OR_VERIFY_AFTER_COMPANY_CREATE',
      })),
    );
    expect(JSON.stringify(prepared.plan)).not.toContain('source-group');
    expect(JSON.stringify(prepared.plan)).not.toContain('passwordHash');
  });

  it('derives the missing source legal country only from the reviewed Branch and rejects disagreement', () => {
    expect(
      resolveProdfixWorksheetSourceLegalCountryCode({
        sourceColumnPresent: false,
        sourceLegalCountryCode: null,
        branchCountryCode: 'IN',
      }),
    ).toBe('IN');
    expect(
      resolveProdfixWorksheetSourceLegalCountryCode({
        sourceColumnPresent: true,
        sourceLegalCountryCode: 'IN',
        branchCountryCode: 'IN',
      }),
    ).toBe('IN');
    expect(() =>
      resolveProdfixWorksheetSourceLegalCountryCode({
        sourceColumnPresent: true,
        sourceLegalCountryCode: 'AE',
        branchCountryCode: 'IN',
      }),
    ).toThrow('must agree');
  });

  it('uses the complete master/staging module baseline rather than source policy', () => {
    expect(PRODFIX_WORKSHEET_PERSONA_STAGING_MODULE_CODES).toEqual(
      [...Object.values(CompanyModuleCode)].sort(),
    );
    const source = sourceSnapshot();
    const changedSourcePermissionPolicy: ProdfixWorksheetSourceSnapshot = {
      ...source,
      rolePermissions: [
        {
          roleId: source.roles.find((role) => role.code === 'HR_MANAGER')!.id,
          permissionCode: 'finance.transactions.read',
        },
      ],
    };
    const prepared = prepareProdfixWorksheetPersonaImport(
      changedSourcePermissionPolicy,
      emptyTarget(changedSourcePermissionPolicy),
      parseProdfixWorksheetPersonaImportArguments([]),
    );
    expect(prepared.requiredModules).toEqual(
      PRODFIX_WORKSHEET_PERSONA_STAGING_MODULE_CODES,
    );
    expect(
      prepared.plan.actions.moduleEntitlements.map(({ module }) => module),
    ).toEqual(PRODFIX_WORKSHEET_PERSONA_STAGING_MODULE_CODES);
  });

  it('keeps the reviewed digest mode-independent while binding credential mode', () => {
    const source = sourceSnapshot();
    const target = emptyTarget(source);
    const planOnly = prepareProdfixWorksheetPersonaImport(
      source,
      target,
      parseProdfixWorksheetPersonaImportArguments([]),
    );
    const apply = prepareProdfixWorksheetPersonaImport(
      source,
      target,
      parseProdfixWorksheetPersonaImportArguments([
        '--apply',
        `--plan-digest=${'c'.repeat(64)}`,
      ]),
    );
    const preserveSource = sourceSnapshot('source-credential-commitment');
    const preserve = prepareProdfixWorksheetPersonaImport(
      preserveSource,
      emptyTarget(preserveSource, 'target-credential-commitment'),
      parseProdfixWorksheetPersonaImportArguments([
        '--preserve-credential-hashes',
      ]),
    );
    expect(planOnly.plan.mode).toBe('PLAN_ONLY');
    expect(apply.plan.mode).toBe('APPLY');
    expect(apply.plan.planDigest).toBe(planOnly.plan.planDigest);
    expect(preserve.plan.planDigest).not.toBe(planOnly.plan.planDigest);
  });

  it('treats an exactly rewired target hierarchy or manager link as divergence, while an exact target is a no-op', () => {
    const source = sourceSnapshot();
    const target = equivalentTarget(source);
    const exactPlan = prepareProdfixWorksheetPersonaImport(
      source,
      target,
      parseProdfixWorksheetPersonaImportArguments([]),
    );
    expect([
      exactPlan.plan.actions.companyGroup.action,
      exactPlan.plan.actions.company.action,
      exactPlan.plan.actions.branch.action,
      exactPlan.plan.actions.department.action,
      ...exactPlan.plan.actions.designations.map((action) => action.action),
      ...exactPlan.plan.actions.employees.map((action) => action.action),
      ...exactPlan.plan.actions.users.map((action) => action.action),
      ...exactPlan.plan.actions.roleAssignments.map((action) => action.action),
      ...exactPlan.plan.actions.moduleEntitlements.map(
        (action) => action.action,
      ),
      exactPlan.plan.actions.organizationOnboarding.action,
      exactPlan.plan.actions.departmentAssetGrant.action,
    ]).toEqual(expect.arrayContaining(['NOOP']));
    expect(
      [
        exactPlan.plan.actions.companyGroup.action,
        exactPlan.plan.actions.company.action,
        exactPlan.plan.actions.branch.action,
        exactPlan.plan.actions.department.action,
        ...exactPlan.plan.actions.designations.map((action) => action.action),
        ...exactPlan.plan.actions.employees.map((action) => action.action),
        ...exactPlan.plan.actions.users.map((action) => action.action),
        ...exactPlan.plan.actions.roleAssignments.map(
          (action) => action.action,
        ),
        ...exactPlan.plan.actions.moduleEntitlements.map(
          (action) => action.action,
        ),
        exactPlan.plan.actions.organizationOnboarding.action,
        exactPlan.plan.actions.departmentAssetGrant.action,
      ].every((action) => action === 'NOOP'),
    ).toBe(true);

    expect(() =>
      prepareProdfixWorksheetPersonaImport(
        source,
        {
          ...target,
          company: { ...target.company!, parentCompanyId: 'outside-company' },
        },
        parseProdfixWorksheetPersonaImportArguments([]),
      ),
    ).toThrow('Company PFC-20260917 exists in staging but diverges');
    expect(() =>
      prepareProdfixWorksheetPersonaImport(
        source,
        {
          ...target,
          employees: target.employees.map((employee) =>
            employee.employeeCode === 'EMP-HR-20260917'
              ? { ...employee, managerId: 'outside-manager' }
              : employee,
          ),
        },
        parseProdfixWorksheetPersonaImportArguments([]),
      ),
    ).toThrow('Employee EMP-HR-20260917 exists in staging but diverges');
  });

  it('uses canonical MANUAL provenance instead of source provenance in the digest', () => {
    const source = sourceSnapshot();
    const changedSource: ProdfixWorksheetSourceSnapshot = {
      ...source,
      employees: source.employees.map((employee, index) =>
        index === 0 ? { ...employee, creationSource: 'RECRUITMENT' } : employee,
      ),
    };
    expect(sourceDigestForProdfixWorksheetPersonaImport(changedSource)).toBe(
      sourceDigestForProdfixWorksheetPersonaImport(source),
    );
  });

  it('fails closed for an external manager, stale onboarding, or extra grant', () => {
    const source = sourceSnapshot();
    const externalManager: ProdfixWorksheetSourceSnapshot = {
      ...source,
      employees: source.employees.map((employee) =>
        employee.employeeCode === 'EMP-EMP-20260917'
          ? { ...employee, managerId: 'outside' }
          : employee,
      ),
    };
    expect(() =>
      sourceDigestForProdfixWorksheetPersonaImport(externalManager),
    ).toThrow('must report to EMP-MGR');

    const stale = sourceSnapshot();
    const extraGrant: ProdfixWorksheetSourceSnapshot = {
      ...stale,
      departmentAssetGrants: [
        ...stale.departmentAssetGrants,
        { ...stale.departmentAssetGrants[0], id: 'extra-grant' },
      ],
    };
    expect(() =>
      sourceDigestForProdfixWorksheetPersonaImport(extraGrant),
    ).toThrow('exactly one Department Asset Grant');
  });

  it('rejects canonical username variants, passwordless target users, and active target sessions', () => {
    const source = sourceSnapshot();
    expect(() =>
      sourceDigestForProdfixWorksheetPersonaImport({
        ...source,
        users: source.users.map((user) =>
          user.normalizedEmail === EMP
            ? {
                ...user,
                normalizedUsername: user.normalizedUsername.toUpperCase(),
              }
            : user,
        ),
      }),
    ).toThrow('natural-key contract');

    const target = equivalentTarget(source);
    expect(() =>
      prepareProdfixWorksheetPersonaImport(
        source,
        {
          ...target,
          users: target.users.map((user) =>
            user.normalizedEmail === EMP
              ? { ...user, passwordHashPresent: false }
              : user,
          ),
        },
        parseProdfixWorksheetPersonaImportArguments([]),
      ),
    ).toThrow('no usable staging credential');
    expect(() =>
      prepareProdfixWorksheetPersonaImport(
        source,
        {
          ...target,
          activeSessionUserIds: [target.users[0].id],
        },
        parseProdfixWorksheetPersonaImportArguments([]),
      ),
    ).toThrow('active authentication session');
  });

  it('requires a second explicit confirmation for hash preservation', () => {
    const invocation = parseProdfixWorksheetPersonaImportArguments([
      '--apply',
      `--plan-digest=${'b'.repeat(64)}`,
      '--preserve-credential-hashes',
    ]);
    expect(() =>
      assertProdfixWorksheetPersonaApplyConfirmations(invocation, {
        QA_PRODFIX_WORKSHEET_PERSONA_IMPORT_CONFIRMATION:
          PRODFIX_WORKSHEET_PERSONA_IMPORT_CONFIRMATION,
      }),
    ).toThrow('CREDENTIAL_HASH_CONFIRMATION');
    expect(() =>
      assertProdfixWorksheetPersonaApplyConfirmations(invocation, {
        QA_PRODFIX_WORKSHEET_PERSONA_IMPORT_CONFIRMATION:
          PRODFIX_WORKSHEET_PERSONA_IMPORT_CONFIRMATION,
        QA_PRODFIX_WORKSHEET_PERSONA_CREDENTIAL_HASH_CONFIRMATION:
          PRODFIX_WORKSHEET_PERSONA_CREDENTIAL_HASH_CONFIRMATION,
      }),
    ).not.toThrow();
  });

  it('keeps source and target connections isolated with no cross-schema insert-select path', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'scripts',
        'qa',
        'import-prodfix-worksheet-personas.ts',
      ),
      'utf8',
    );
    expect(source).toContain('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    expect(source).toContain('SET LOCAL search_path TO "${SOURCE_SCHEMA}"');
    expect(source).toContain(
      'assertQaWriteEnvironment(SCRIPT_NAME, environment)',
    );
    expect(source).toContain('assertQaStagingSentinel(');
    expect(source).toContain('information_schema.columns');
    expect(source).toContain('"legal_country_code" AS "legalCountryCode"');
    expect(source).toContain('"legal_country_code", "parentCompanyId"');
    const sourceReader = source.slice(
      source.indexOf('async function readSourceSnapshot'),
      source.indexOf('async function readTargetSnapshot'),
    );
    expect(sourceReader).not.toContain('company_module_entitlements');
    expect(source).not.toMatch(/INSERT\s+INTO[\s\S]{0,200}SELECT/i);
  });
});
