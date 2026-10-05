import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  REFERENCE_DATA_CONTRACT,
  referenceDataContractFingerprint,
  validateReferenceDataContract,
} from '../../scripts/qa/reference-data-contract';
import {
  buildReferenceMasterDataPlan,
  REFERENCE_MASTER_DATA,
} from '../../scripts/qa/reference-master-data';
import { DISABLED_QA_ACTOR_PASSWORD_MARKER } from '../../scripts/qa/reference-master-data-seeder';
import {
  buildReferencePersonaProvisioningPlan,
  buildRoleAssignmentData,
  readReferencePersonaPassword,
  validateReferencePersonaPassword,
} from '../../scripts/qa/reference-persona-seeder';
import {
  cleanupRecordsInDependencyOrder,
  createQaRunManifest,
  recordCreatedEntity,
  validateQaRunManifest,
} from '../../scripts/qa/qa-run-manifest';
import {
  findExplicitSchemaReferences,
  findSchemaNeutralityViolations,
  IMMUTABLE_LEGACY_SCHEMA_QUALIFIED_MIGRATIONS,
  sha256,
} from '../../scripts/qa/schema-neutral-sql';

describe('QA reference-data and run-manifest contracts', () => {
  it('defines a valid multi-company, multi-country, isolation dataset', () => {
    expect(() => validateReferenceDataContract()).not.toThrow();
    expect(REFERENCE_DATA_CONTRACT.groups).toHaveLength(2);
    expect(REFERENCE_DATA_CONTRACT.companies).toHaveLength(3);
    expect(
      REFERENCE_DATA_CONTRACT.companies.flatMap((company) => company.branches),
    ).toHaveLength(6);
    expect(REFERENCE_DATA_CONTRACT.personas.length).toBeGreaterThanOrEqual(20);
    expect(referenceDataContractFingerprint()).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps maker and approver personas distinct in both primary Companies', () => {
    const byKey = new Map(
      REFERENCE_DATA_CONTRACT.personas.map((persona) => [persona.key, persona]),
    );
    expect(byKey.get('india-finance-maker')?.email).not.toBe(
      byKey.get('india-finance-payroll-approver')?.email,
    );
    expect(byKey.get('uae-finance-maker')?.email).not.toBe(
      byKey.get('uae-finance-payroll-approver')?.email,
    );
  });

  it('defines the exact stable User, Employee, scope, and reporting-line plan', () => {
    const plan = buildReferencePersonaProvisioningPlan();
    const profiles = new Map(
      plan.profiles.map((profile) => [profile.personaKey, profile]),
    );

    expect(plan.contractVersion).toBe(3);
    expect(plan.profiles).toHaveLength(23);
    expect(plan.profiles.filter((profile) => profile.userRecord)).toHaveLength(
      22,
    );
    expect(
      plan.profiles.filter((profile) => profile.employeeRecord),
    ).toHaveLength(22);
    expect(
      plan.profiles.filter(
        (profile) => profile.employeeRecord && !profile.userRecord,
      ),
    ).toHaveLength(1);
    expect(profiles.get('platform-super-admin')).toMatchObject({
      userRecord: true,
      employeeRecord: false,
      companyCode: null,
      roleAssignments: [{ roleName: 'Super Administrator', scope: 'GLOBAL' }],
    });
    expect(profiles.get('india-owner')?.roleAssignments).toEqual([
      { roleName: 'Organization Owner', scope: 'COMPANY_GROUP' },
    ]);
    expect(profiles.get('india-employee')).toMatchObject({
      branchCode: 'IN-BLR-DC-QA',
      departmentCode: 'ENG-QA',
      managerPersonaKey: 'india-engineering-manager',
    });
    expect(profiles.get('india-engineering-manager')?.branchCode).toBe(
      'IN-KOCHI-HQ-QA',
    );
    expect(profiles.get('uae-employee')).toMatchObject({
      branchCode: 'AE-AUH-OPS-QA',
      managerPersonaKey: 'uae-reporting-project-manager',
    });
    expect(profiles.get('uae-reporting-project-manager')?.branchCode).toBe(
      'AE-DXB-HQ-QA',
    );
    expect(plan.departmentGrants).toEqual([
      {
        personaKey: 'india-asset-custodian',
        departmentCode: 'ENG-QA',
      },
    ]);
  });

  it('keeps maker roles least-privilege and the Auditor strictly read-only', () => {
    const roles = new Map(
      REFERENCE_DATA_CONTRACT.personaProvisioning.customRoles.map((role) => [
        role.name,
        role,
      ]),
    );

    expect(roles.get('Finance Maker')?.permissionCodes).toContain(
      'finance.transactions.manage',
    );
    expect(roles.get('Finance Maker')?.permissionCodes).not.toContain(
      'finance.transactions.approve',
    );
    expect(roles.get('Finance Maker')?.permissionCodes).not.toContain(
      'finance.transactions.reverse',
    );
    expect(roles.get('Payroll Maker')?.permissionCodes).toContain(
      'payroll.payroll.manage',
    );
    expect(roles.get('Payroll Maker')?.permissionCodes).not.toContain(
      'payroll.payroll.approve',
    );
    expect(
      roles
        .get('Read-only Auditor')
        ?.permissionCodes.every((code) => code.endsWith('.read')),
    ).toBe(true);
  });

  it('builds canonical organization scope keys without scope leakage', () => {
    expect(
      buildRoleAssignmentData('role-global', 'GLOBAL', {
        companyGroupId: null,
        companyId: null,
        branchId: null,
      }),
    ).toMatchObject({
      scope: 'GLOBAL',
      scopeKey: 'GLOBAL',
      companyGroupId: null,
      companyId: null,
      branchId: null,
    });
    expect(
      buildRoleAssignmentData('role-branch', 'BRANCH', {
        companyGroupId: 'group-1',
        companyId: 'company-1',
        branchId: 'branch-1',
      }),
    ).toMatchObject({
      scope: 'BRANCH',
      scopeKey: 'BRANCH:branch-1',
      companyGroupId: null,
      companyId: 'company-1',
      branchId: 'branch-1',
    });
    expect(() =>
      buildRoleAssignmentData('role-branch', 'BRANCH', {
        companyGroupId: 'group-1',
        companyId: 'company-1',
        branchId: null,
      }),
    ).toThrow('requires a Company and Branch');
  });

  it('requires out-of-band credentials without exposing them in errors or evidence plans', () => {
    const secret = 'QA-only-long-password-value';
    expect(
      readReferencePersonaPassword({
        QA_REFERENCE_PERSONA_PASSWORD: secret,
      }),
    ).toBe(secret);
    expect(() =>
      readReferencePersonaPassword({
        QA_REFERENCE_PERSONA_PASSWORD: 'short',
      }),
    ).toThrow('between 12 and 128 characters');
    try {
      readReferencePersonaPassword({
        QA_REFERENCE_PERSONA_PASSWORD: 'short',
      });
    } catch (error) {
      expect(String(error)).not.toContain('short');
    }
    expect(
      JSON.stringify(buildReferencePersonaProvisioningPlan()),
    ).not.toContain(secret);
    expect(() => validateReferencePersonaPassword('qa.india-owner')).toThrow(
      'must not equal a persona email or username',
    );
  });

  it('uses a deliberately invalid credential marker for disabled QA identities', () => {
    expect(DISABLED_QA_ACTOR_PASSWORD_MARKER).not.toMatch(/^\$argon2/);
    expect(DISABLED_QA_ACTOR_PASSWORD_MARKER).toContain('DISABLED');
    expect(
      REFERENCE_DATA_CONTRACT.personas.find(
        (persona) => persona.key === 'india-disabled',
      ),
    ).toMatchObject({ loginEnabled: false, employeeRecord: true });
  });

  it('defines deterministic seeded and contract-only master-data layers', () => {
    const plan = buildReferenceMasterDataPlan();
    const byKey = new Map(plan.map((layer) => [layer.key, layer]));

    expect(plan).toHaveLength(19);
    expect(plan.filter((layer) => layer.mode === 'SEEDED')).toHaveLength(8);
    expect(plan.filter((layer) => layer.mode === 'CONTRACT_ONLY')).toHaveLength(
      11,
    );
    expect(
      byKey.get('financial-profiles-categories-accounts-and-open-periods'),
    ).toMatchObject({ mode: 'SEEDED', itemCount: 16 });
    expect(byKey.get('salary-components')).toMatchObject({
      mode: 'SEEDED',
      itemCount: 6,
    });
    expect(byKey.get('leave-types-and-branch-policies')).toMatchObject({
      mode: 'SEEDED',
      itemCount: 23,
    });
    expect(byKey.get('workforce-approval-routes')).toMatchObject({
      mode: 'SEEDED',
      itemCount: 12,
    });
    expect(
      byKey.get('service-owned-independent-approval-controls'),
    ).toMatchObject({
      mode: 'CONTRACT_ONLY',
      itemCount: 4,
    });
    expect(byKey.get('business-parties-and-baseline-projects')).toMatchObject({
      mode: 'SEEDED',
      itemCount: 6,
    });
    expect(byKey.get('project-stage-and-task-state-baseline')).toMatchObject({
      mode: 'CONTRACT_ONLY',
      itemCount: 12,
    });
    expect(byKey.get('asset-and-software-licence-baseline')).toMatchObject({
      mode: 'SEEDED',
      itemCount: 20,
    });
    expect(byKey.get('encrypted-access-card-sample')).toMatchObject({
      mode: 'CONTRACT_ONLY',
      itemCount: 1,
    });
    expect(byKey.get('company-module-entitlements')).toMatchObject({
      mode: 'CONTRACT_ONLY',
      itemCount: 2,
    });
    expect(byKey.get('currency-catalog')).toMatchObject({
      mode: 'CONTRACT_ONLY',
      itemCount: 2,
    });
    expect(byKey.get('published-onboarding-templates')).toMatchObject({
      mode: 'CONTRACT_ONLY',
      itemCount: 2,
    });
    for (const layer of plan.filter(
      (candidate) => candidate.mode === 'CONTRACT_ONLY',
    )) {
      expect(layer.reason.length).toBeGreaterThan(40);
    }
  });

  it('keeps the bounded salary, party, and approval baseline exact', () => {
    for (const company of REFERENCE_MASTER_DATA.salaryComponents) {
      expect(
        company.components.map(({ code, type }) => ({ code, type })),
      ).toEqual([
        { code: 'BASIC-QA', type: 'EARNING' },
        { code: 'ALLOWANCE-QA', type: 'EARNING' },
        { code: 'DEDUCTION-QA', type: 'DEDUCTION' },
      ]);
    }

    expect(
      REFERENCE_MASTER_DATA.finance.flatMap((company) =>
        company.parties.map((party) => ({
          companyCode: company.companyCode,
          code: party.code,
          type: party.type,
        })),
      ),
    ).toEqual([
      {
        companyCode: 'DSP-IN-QA',
        code: 'CUSTOMER-NORTHSTAR-QA',
        type: 'CUSTOMER',
      },
      {
        companyCode: 'DSP-IN-QA',
        code: 'VENDOR-OFFICE-QA',
        type: 'VENDOR',
      },
      {
        companyCode: 'DSP-AE-QA',
        code: 'CUSTOMER-GULF-QA',
        type: 'CUSTOMER',
      },
    ]);

    for (const companyCode of ['DSP-IN-QA', 'DSP-AE-QA']) {
      const workflows = REFERENCE_MASTER_DATA.approvalWorkflows.filter(
        (workflow) => workflow.companyCode === companyCode,
      );
      expect(workflows.map((workflow) => workflow.workflowCode).sort()).toEqual(
        ['LEAVE_APPROVAL', 'OVERTIME_APPROVAL'],
      );
      for (const workflow of workflows) {
        expect(workflow.steps).toEqual([
          {
            stepNo: 1,
            approverType: 'REPORTING_MANAGER',
            approverRole: null,
          },
          { stepNo: 2, approverType: 'ROLE', approverRole: 'HR_MANAGER' },
        ]);
      }
    }

    expect(
      REFERENCE_MASTER_DATA.serviceOwnedApprovalControls.map(
        (control) => control.key,
      ),
    ).toEqual([
      'timesheet-manager',
      'finance-independent-checker',
      'payroll-independent-checker',
      'asset-waiver-independent-checker',
    ]);
    for (const control of REFERENCE_MASTER_DATA.serviceOwnedApprovalControls) {
      expect(control.modelGap).toContain('ApprovalWorkflow');
    }
  });

  it('contracts service-owned Project states and the bounded Asset sample', () => {
    expect(REFERENCE_MASTER_DATA.projectExecutionScenarios).toHaveLength(3);
    for (const scenario of REFERENCE_MASTER_DATA.projectExecutionScenarios) {
      expect(scenario.tasks.map((task) => task.state)).toEqual([
        'OPEN',
        'IN_PROGRESS',
        'WAITING_REVIEW',
      ]);
    }

    const indiaAssets = REFERENCE_MASTER_DATA.assets.find(
      (company) => company.companyCode === 'DSP-IN-QA',
    );
    const uaeAssets = REFERENCE_MASTER_DATA.assets.find(
      (company) => company.companyCode === 'DSP-AE-QA',
    );
    expect(indiaAssets?.inventory.map((asset) => asset.code)).toEqual([
      'LAPTOP-AVAILABLE-IN-QA',
      'LAPTOP-ONBOARDING-IN-QA',
      'OFFICE-EQUIPMENT-IN-QA',
      'SAAS-POOL-IN-QA',
    ]);
    expect(
      indiaAssets?.types.find((type) => type.code === 'ACCESS-CARD-QA'),
    ).toMatchObject({ kind: 'CARD', trackingMode: 'INDIVIDUAL' });
    expect(REFERENCE_MASTER_DATA.encryptedAccessCardSamples).toHaveLength(1);
    expect(
      indiaAssets?.inventory.find(
        (asset) => asset.code === 'OFFICE-EQUIPMENT-IN-QA',
      )?.location,
    ).toBe('Kochi Storage QA');
    expect(uaeAssets?.inventory).toHaveLength(2);
    for (const company of REFERENCE_MASTER_DATA.assets) {
      const licence = company.inventory.find(
        (asset) => asset.softwareLicense !== null,
      );
      expect(licence?.softwareLicense?.seatCapacity).toBe(2);
    }
  });

  it('keeps every reference business code and name visibly QA-marked', () => {
    const financeCodes = REFERENCE_MASTER_DATA.finance.flatMap((company) => [
      ...company.categories.map((row) => row.code),
      ...company.accounts.map((row) => row.code),
      ...company.parties.map((row) => row.code),
    ]);
    const salaryCodes = REFERENCE_MASTER_DATA.salaryComponents.flatMap(
      (company) => company.components.map((row) => row.code),
    );
    const leaveCodes = REFERENCE_MASTER_DATA.leave.flatMap((company) =>
      company.types.map((row) => row.code),
    );
    const projectCodes = REFERENCE_MASTER_DATA.projects.map(
      (project) => project.code,
    );
    const projectExecutionCodes =
      REFERENCE_MASTER_DATA.projectExecutionScenarios.flatMap((scenario) => [
        scenario.stage.code,
        ...scenario.tasks.map((task) => task.code),
      ]);
    const assetCodes = REFERENCE_MASTER_DATA.assets.flatMap((company) => [
      ...company.categories.map((row) => row.code),
      ...company.types.map((row) => row.code),
      ...company.inventory.map((row) => row.code),
    ]);
    const encryptedAccessCardCodes =
      REFERENCE_MASTER_DATA.encryptedAccessCardSamples.map(
        (sample) => sample.code,
      );

    for (const code of [
      ...financeCodes,
      ...salaryCodes,
      ...leaveCodes,
      ...projectCodes,
      ...projectExecutionCodes,
      ...assetCodes,
      ...encryptedAccessCardCodes,
    ]) {
      expect(code).toMatch(/-QA$/);
    }
    const names = [
      ...REFERENCE_MASTER_DATA.finance.flatMap((company) => [
        ...company.categories.map((row) => row.name),
        ...company.accounts.map((row) => row.name),
        ...company.parties.map((row) => row.name),
      ]),
      ...REFERENCE_MASTER_DATA.salaryComponents.flatMap((company) =>
        company.components.map((row) => row.name),
      ),
      ...REFERENCE_MASTER_DATA.leave.flatMap((company) =>
        company.types.map((row) => row.name),
      ),
      ...REFERENCE_MASTER_DATA.approvalWorkflows.map(
        (workflow) => workflow.workflowName,
      ),
      ...REFERENCE_MASTER_DATA.onboardingTemplates.flatMap((template) => [
        template.templateName,
        ...template.departments.flatMap((department) => department.tasks),
      ]),
      ...REFERENCE_MASTER_DATA.projects.map((project) => project.name),
      ...REFERENCE_MASTER_DATA.projectExecutionScenarios.flatMap((scenario) => [
        scenario.stage.name,
        ...scenario.tasks.map((task) => task.name),
      ]),
      ...REFERENCE_MASTER_DATA.assets.flatMap((company) => [
        ...company.categories.map((row) => row.name),
        ...company.types.map((row) => row.name),
        ...company.inventory.map((row) => row.name),
      ]),
      ...REFERENCE_MASTER_DATA.encryptedAccessCardSamples.map(
        (sample) => sample.name,
      ),
    ];
    for (const name of names) {
      expect(name).toMatch(/QA$/);
    }
    expect(REFERENCE_MASTER_DATA.seedActor.email).toMatch(
      /@dsp-reference\.invalid$/,
    );
    expect(REFERENCE_MASTER_DATA.seedActor.displayName).toContain('QA');
  });

  it('uses exact branch policy scopes and keeps legacy/canonical project values aligned', () => {
    const contractBranches = new Map(
      REFERENCE_DATA_CONTRACT.companies.map((company) => [
        company.code,
        new Set(company.branches.map((branch) => branch.code)),
      ]),
    );
    for (const leave of REFERENCE_MASTER_DATA.leave) {
      expect(new Set(leave.branchCodes).size).toBe(leave.branchCodes.length);
      for (const branchCode of leave.branchCodes) {
        expect(contractBranches.get(leave.companyCode)?.has(branchCode)).toBe(
          true,
        );
      }
      expect(
        leave.types.find((type) => type.category === 'COMP_OFF')
          ?.annualEntitlement,
      ).toBeNull();
    }
    for (const project of REFERENCE_MASTER_DATA.projects) {
      expect(project.currencyCode).toMatch(/^[A-Z]{3}$/);
      expect(project.projectType).toMatch(/^(CLIENT|INTERNAL)$/);
    }
  });

  it('records exact run-owned IDs and orders cleanup from dependants to parents', () => {
    const manifest = createQaRunManifest({
      suite: 'finance golden thread',
      gitCommit: 'abc123',
      contractFingerprint: referenceDataContractFingerprint(),
      now: new Date('2026-09-17T09:30:00.000Z'),
    });
    recordCreatedEntity(manifest, {
      entityType: 'FinanceTransaction',
      id: 'transaction-id',
      companyId: 'company-id',
      cleanupOrder: 10,
    });
    recordCreatedEntity(manifest, {
      entityType: 'FinanceTransactionAttachment',
      id: 'attachment-id',
      companyId: 'company-id',
      cleanupOrder: 20,
    });

    expect(() => validateQaRunManifest(manifest)).not.toThrow();
    expect(
      cleanupRecordsInDependencyOrder(manifest).map((row) => row.id),
    ).toEqual(['attachment-id', 'transaction-id']);
  });

  it('rejects cleanup manifests aimed at the current schema', () => {
    const manifest = createQaRunManifest({
      suite: 'isolation',
      gitCommit: 'abc123',
      contractFingerprint: referenceDataContractFingerprint(),
      now: new Date('2026-09-17T09:30:00.000Z'),
    });
    manifest.target.databaseSchema = 'dsp_pms';
    expect(() => validateQaRunManifest(manifest)).toThrow(
      'approved staging schema',
    );
  });

  it('detects schema-qualified migration SQL', () => {
    expect(
      findExplicitSchemaReferences(
        'CREATE TABLE "dsp_pms"."unsafe" (id TEXT); REFERENCES other_schema.users(id);',
      ),
    ).toEqual(['dsp_pms.unsafe', 'other_schema.users']);
    expect(
      findExplicitSchemaReferences('CREATE TABLE users (id TEXT);'),
    ).toEqual([]);
  });

  it.each([
    ['SET search_path TO dsp_pms', 'search_path mutation'],
    ['SET LOCAL search_path = public', 'search_path mutation'],
    ["SET SCHEMA 'public'", 'search_path mutation'],
    ['RESET search_path', 'search_path mutation'],
    ['RESET ALL', 'session configuration reset'],
    ['DISCARD ALL', 'session configuration reset'],
    ["SELECT set_config('search_path', 'dsp_pms', false)", 'set_config call'],
    [
      "SELECT \"set_config\"('search_path', 'public', false)",
      'set_config call',
    ],
    ["SELECT '--'; SET search_path TO public", 'search_path mutation'],
    [
      "SELECT '/*'; ALTER TABLE users SET SCHEMA dsp_pms; SELECT '*/'",
      'schema namespace mutation',
    ],
    ['CREATE SCHEMA dsp_pms', 'schema namespace mutation'],
    ['DROP SCHEMA "dsp_pms"', 'schema namespace mutation'],
    ['ALTER SCHEMA dsp_pms RENAME TO other', 'schema namespace mutation'],
    ['ALTER TABLE users SET SCHEMA dsp_pms', 'schema namespace mutation'],
    [
      "DO $body$ BEGIN EXECUTE 'UPDATE dsp_pms.users SET status = ''ACTIVE'''; END $body$",
      'dynamic SQL EXECUTE',
    ],
    [
      "DO 'BEGIN EXECUTE ''SET search_path TO public''; END' LANGUAGE plpgsql",
      'dynamic SQL EXECUTE',
    ],
    [
      "CREATE FUNCTION unsafe() RETURNS void AS 'BEGIN EXECUTE ''DELETE FROM public.users''; END' LANGUAGE plpgsql",
      'dynamic SQL EXECUTE',
    ],
    [
      "DO $$ BEGIN EXECUTE format('ALTER TABLE %I.%I ADD COLUMN unsafe text', 'dsp_pms', 'users'); END $$",
      'dynamic SQL EXECUTE',
    ],
    [
      'PREPARE unsafe AS DELETE FROM users; EXECUTE unsafe',
      'dynamic SQL EXECUTE',
    ],
    [
      'ALTER TABLE "evil_schema"."users" ADD COLUMN unsafe text',
      'schema reference evil_schema.users',
    ],
    [
      'CREATE TRIGGER unsafe BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION evil_schema.guard()',
      'schema reference evil_schema.guard',
    ],
    [
      "SELECT nextval('public.sequence_name'::regclass)",
      'schema reference public.sequence_name',
    ],
  ])('rejects schema-control or dynamic SQL: %s', (sql, violation) => {
    expect(findSchemaNeutralityViolations(sql)).toContain(violation);
  });

  it.each([
    'CREATE TABLE users (id TEXT)',
    'ALTER TABLE users ADD COLUMN status TEXT',
    'CREATE TRIGGER users_guard BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION users_guard()',
    "COMMENT ON TABLE users IS 'SET search_path and EXECUTE are documentation only'",
    'SELECT "execute" FROM jobs',
    "SELECT '-- not a comment'; UPDATE users SET status = 'ACTIVE'",
    'SELECT pg_catalog.now()',
    'SELECT * FROM information_schema.columns',
    '-- SET search_path TO public\nCREATE TABLE users (id TEXT)',
    '/* EXECUTE unsafe */ ALTER TABLE users ADD COLUMN status TEXT',
  ])('permits schema-neutral static SQL: %s', (sql) => {
    expect(findSchemaNeutralityViolations(sql)).toEqual([]);
  });

  it('keeps every legacy exception immutable by its normalized SHA-256', () => {
    for (const [path, expectedHash] of Object.entries(
      IMMUTABLE_LEGACY_SCHEMA_QUALIFIED_MIGRATIONS,
    )) {
      const content = readFileSync(
        resolve(__dirname, '..', '..', path),
        'utf8',
      );
      expect(sha256(content)).toBe(expectedHash);
    }
  });
});
