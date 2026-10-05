import { hash, verify } from 'argon2';
import {
  EmployeeCreationSource,
  Prisma,
  RoleScope,
  UserStatus,
} from '@prisma/client';

import {
  REFERENCE_DATA_CONTRACT,
  type ReferencePersona,
  type ReferencePersonaProvisioningProfile,
} from './reference-data-contract';
import {
  DISABLED_QA_ACTOR_PASSWORD_MARKER,
  type SeedStats,
} from './reference-master-data-seeder';

const REFERENCE_EFFECTIVE_AT = new Date('2026-09-17T00:00:00.000Z');
const ARGON2_HASH_PREFIX = '$argon2';

const PERSONA_LAYER_KEYS = [
  'custom-roles-and-permissions',
  'stable-employees',
  'reporting-lines',
  'stable-users',
  'scoped-role-assignments',
  'department-asset-grants',
] as const;

type PersonaLayerKey = (typeof PERSONA_LAYER_KEYS)[number];

export type ReferencePersonaSeedResult = {
  layers: Record<PersonaLayerKey, SeedStats>;
  totals: SeedStats;
  personaCounts: {
    profiles: number;
    users: number;
    employees: number;
    enabledLogins: number;
    disabledLogins: number;
    employeeWithoutLogin: number;
  };
};

export type ReferencePersonaSeedOptions = {
  allowCredentialRotation?: boolean;
};

export function buildUnexpiredPendingCredentialChallengeWhere(
  userId: string,
  now: Date,
): {
  userId: string;
  consumedAt: null;
  revokedAt: null;
  expiresAt: { gt: Date };
} {
  return {
    userId,
    consumedAt: null,
    revokedAt: null,
    expiresAt: { gt: now },
  };
}

type PersonaContext = {
  companyGroupId: string | null;
  companyId: string | null;
  branchId: string | null;
  departmentId: string | null;
  designationId: string | null;
};

type RoleAssignmentData = {
  roleId: string;
  scope: RoleScope;
  scopeKey: string;
  companyGroupId: string | null;
  companyId: string | null;
  branchId: string | null;
};

function emptyStats(): SeedStats {
  return { created: 0, updated: 0, unchanged: 0 };
}

function createLayerStats(): Record<PersonaLayerKey, SeedStats> {
  return Object.fromEntries(
    PERSONA_LAYER_KEYS.map((key) => [key, emptyStats()]),
  ) as Record<PersonaLayerKey, SeedStats>;
}

function record(stats: SeedStats, action: keyof SeedStats): void {
  stats[action] += 1;
}

function sumStats(values: ReadonlyArray<SeedStats>): SeedStats {
  return values.reduce(
    (total, value) => ({
      created: total.created + value.created,
      updated: total.updated + value.updated,
      unchanged: total.unchanged + value.unchanged,
    }),
    emptyStats(),
  );
}

function valuesEqual(current: unknown, desired: unknown): boolean {
  if (current instanceof Date && desired instanceof Date) {
    return current.getTime() === desired.getTime();
  }
  return current === desired;
}

function changed<T extends object>(
  current: T,
  desired: Partial<Record<keyof T, unknown>>,
): boolean {
  return Object.entries(desired).some(
    ([key, value]) => !valuesEqual(current[key as keyof T], value),
  );
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function displayName(personaKey: string): string {
  const label = personaKey
    .split('-')
    .map((part) =>
      part === 'uae'
        ? 'UAE'
        : part.charAt(0).toLocaleUpperCase('en-US') + part.slice(1),
    )
    .join(' ');
  return `QA ${label}`;
}

function provisioningProfiles(): ReadonlyArray<ReferencePersonaProvisioningProfile> {
  return REFERENCE_DATA_CONTRACT.personaProvisioning.profiles;
}

export function readReferencePersonaPassword(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const variable =
    REFERENCE_DATA_CONTRACT.personaProvisioning.credentialEnvironmentVariable;
  const password = environment[variable];
  if (!password) {
    throw new Error(
      `${variable} must contain a 12-128 character staging-only password; its value is never written to QA evidence.`,
    );
  }
  validateReferencePersonaPassword(password);
  return password;
}

export function validateReferencePersonaPassword(password: string): void {
  if (password.length < 12 || password.length > 128) {
    throw new Error(
      'The QA persona password must contain between 12 and 128 characters.',
    );
  }
  const normalizedPassword = normalize(password);
  const profileByKey = new Map(
    provisioningProfiles().map((profile) => [profile.personaKey, profile]),
  );
  const identityValues = new Set(
    REFERENCE_DATA_CONTRACT.personas.flatMap((persona) => {
      const profile = profileByKey.get(persona.key);
      return [persona.email, profile?.username]
        .filter((value): value is string => Boolean(value))
        .map(normalize);
    }),
  );
  if (identityValues.has(normalizedPassword)) {
    throw new Error(
      'The QA persona password must not equal a persona email or username.',
    );
  }
}

export function buildReferencePersonaProvisioningPlan() {
  const profiles = provisioningProfiles();
  const personaByKey = new Map(
    REFERENCE_DATA_CONTRACT.personas.map((persona) => [persona.key, persona]),
  );
  return {
    contractVersion: REFERENCE_DATA_CONTRACT.version,
    credentialEnvironmentVariable:
      REFERENCE_DATA_CONTRACT.personaProvisioning.credentialEnvironmentVariable,
    customRoles: REFERENCE_DATA_CONTRACT.personaProvisioning.customRoles.map(
      (role) => ({
        code: role.code,
        name: role.name,
        companyGroupCode: role.companyGroupCode,
        permissionCount: role.permissionCodes.length,
      }),
    ),
    profiles: profiles.map((profile) => {
      const persona = personaByKey.get(profile.personaKey);
      if (!persona) {
        throw new Error(`Missing persona contract for ${profile.personaKey}.`);
      }
      return {
        personaKey: profile.personaKey,
        userRecord: profile.userRecord,
        employeeRecord: persona.employeeRecord,
        loginEnabled: persona.loginEnabled,
        companyCode: persona.companyCode,
        branchCode: persona.branchCode,
        departmentCode: profile.departmentCode,
        managerPersonaKey: profile.managerPersonaKey,
        roleAssignments: profile.roleAssignments.map((assignment) => ({
          roleName: assignment.roleName,
          scope: assignment.scope,
        })),
      };
    }),
    departmentGrants:
      REFERENCE_DATA_CONTRACT.personaProvisioning.departmentGrants.map(
        (grant) => ({ ...grant }),
      ),
  };
}

export function buildRoleAssignmentData(
  roleId: string,
  scope: ReferencePersonaProvisioningProfile['roleAssignments'][number]['scope'],
  context: Pick<PersonaContext, 'companyGroupId' | 'companyId' | 'branchId'>,
): RoleAssignmentData {
  if (scope === 'GLOBAL') {
    return {
      roleId,
      scope: RoleScope.GLOBAL,
      scopeKey: 'GLOBAL',
      companyGroupId: null,
      companyId: null,
      branchId: null,
    };
  }
  if (scope === 'COMPANY_GROUP') {
    if (!context.companyGroupId) {
      throw new Error('Company Group role scope requires a Company Group.');
    }
    return {
      roleId,
      scope: RoleScope.COMPANY_GROUP,
      scopeKey: `COMPANY_GROUP:${context.companyGroupId}`,
      companyGroupId: context.companyGroupId,
      companyId: null,
      branchId: null,
    };
  }
  if (scope === 'COMPANY') {
    if (!context.companyId) {
      throw new Error('Company role scope requires a Company.');
    }
    return {
      roleId,
      scope: RoleScope.COMPANY,
      scopeKey: `COMPANY:${context.companyId}`,
      companyGroupId: null,
      companyId: context.companyId,
      branchId: null,
    };
  }
  if (!context.companyId || !context.branchId) {
    throw new Error('Branch role scope requires a Company and Branch.');
  }
  return {
    roleId,
    scope: RoleScope.BRANCH,
    scopeKey: `BRANCH:${context.branchId}`,
    companyGroupId: null,
    companyId: context.companyId,
    branchId: context.branchId,
  };
}

async function requireCompanyGroup(
  tx: Prisma.TransactionClient,
  groupCode: string,
) {
  const group = await tx.companyGroup.findUnique({
    where: { groupCode },
    select: { id: true },
  });
  if (!group) {
    throw new Error(`Missing seeded Company Group ${groupCode}.`);
  }
  return group;
}

async function seedRoles(
  tx: Prisma.TransactionClient,
  stats: SeedStats,
): Promise<Map<string, string>> {
  const roleIds = new Map<string, string>();

  for (const definition of REFERENCE_DATA_CONTRACT.personaProvisioning
    .systemRoleCodes) {
    const role = await tx.role.findUnique({
      where: { code: definition.code },
      select: {
        id: true,
        name: true,
        isSystem: true,
        isActive: true,
        companyGroupId: true,
      },
    });
    if (
      !role ||
      !role.isSystem ||
      !role.isActive ||
      role.companyGroupId !== null ||
      role.name !== definition.name
    ) {
      throw new Error(
        `Required active system Role ${definition.code} is missing or inconsistent.`,
      );
    }
    roleIds.set(definition.name, role.id);
  }

  for (const definition of REFERENCE_DATA_CONTRACT.personaProvisioning
    .customRoles) {
    const group = await requireCompanyGroup(tx, definition.companyGroupCode);
    const normalizedName = normalize(definition.name);
    const [byCode, byName] = await Promise.all([
      tx.role.findUnique({
        where: { code: definition.code },
        select: {
          id: true,
          name: true,
          description: true,
          isSystem: true,
          isActive: true,
          companyGroupId: true,
          normalizedName: true,
        },
      }),
      tx.role.findUnique({
        where: {
          companyGroupId_normalizedName: {
            companyGroupId: group.id,
            normalizedName,
          },
        },
        select: { id: true, code: true },
      }),
    ]);
    if (byCode && byName && byCode.id !== byName.id) {
      throw new Error(
        `${definition.code} collides with another custom Role name.`,
      );
    }
    if (byName && byName.code !== definition.code) {
      throw new Error(
        `${definition.name} already exists under a non-reference Role code.`,
      );
    }
    if (
      byCode &&
      (byCode.isSystem ||
        byCode.companyGroupId !== group.id ||
        byCode.normalizedName !== normalizedName)
    ) {
      throw new Error(
        `${definition.code} collides with a Role outside the QA reference group.`,
      );
    }

    const desiredRole = {
      name: definition.name,
      description: definition.description,
      isActive: true,
    };
    let roleId: string;
    if (!byCode) {
      const created = await tx.role.create({
        data: {
          code: definition.code,
          normalizedName,
          companyGroupId: group.id,
          isSystem: false,
          ...desiredRole,
        },
        select: { id: true },
      });
      roleId = created.id;
      record(stats, 'created');
    } else {
      roleId = byCode.id;
      if (changed(byCode, desiredRole)) {
        await tx.role.update({ where: { id: roleId }, data: desiredRole });
        record(stats, 'updated');
      } else {
        record(stats, 'unchanged');
      }
    }
    roleIds.set(definition.name, roleId);

    const permissions = await tx.permission.findMany({
      where: { code: { in: [...definition.permissionCodes] } },
      select: { id: true, code: true, isTenantAssignable: true },
    });
    const permissionByCode = new Map(
      permissions.map((permission) => [permission.code, permission]),
    );
    for (const code of definition.permissionCodes) {
      const permission = permissionByCode.get(code);
      if (!permission || !permission.isTenantAssignable) {
        throw new Error(
          `${definition.code} requires tenant-assignable Permission ${code}.`,
        );
      }
    }

    const existingMappings = await tx.rolePermission.findMany({
      where: { roleId },
      select: { id: true, permissionId: true },
    });
    const desiredPermissionIds = new Set(
      permissions.map((permission) => permission.id),
    );
    const existingPermissionIds = new Set(
      existingMappings.map((mapping) => mapping.permissionId),
    );
    const staleMappingIds = existingMappings
      .filter((mapping) => !desiredPermissionIds.has(mapping.permissionId))
      .map((mapping) => mapping.id);
    if (staleMappingIds.length > 0) {
      await tx.rolePermission.deleteMany({
        where: { id: { in: staleMappingIds } },
      });
      stats.updated += staleMappingIds.length;
    }
    for (const permission of permissions) {
      if (existingPermissionIds.has(permission.id)) {
        record(stats, 'unchanged');
      } else {
        await tx.rolePermission.create({
          data: { roleId, permissionId: permission.id },
        });
        record(stats, 'created');
      }
    }
  }

  return roleIds;
}

async function resolvePersonaContexts(
  tx: Prisma.TransactionClient,
): Promise<Map<string, PersonaContext>> {
  const contexts = new Map<string, PersonaContext>();
  const personaByKey = new Map(
    REFERENCE_DATA_CONTRACT.personas.map((persona) => [persona.key, persona]),
  );
  for (const profile of provisioningProfiles()) {
    const persona = personaByKey.get(profile.personaKey);
    if (!persona) {
      throw new Error(`Missing persona ${profile.personaKey}.`);
    }
    if (!persona.companyCode) {
      contexts.set(profile.personaKey, {
        companyGroupId: null,
        companyId: null,
        branchId: null,
        departmentId: null,
        designationId: null,
      });
      continue;
    }
    const company = await tx.company.findUnique({
      where: { companyCode: persona.companyCode },
      select: { id: true, companyGroupId: true },
    });
    if (!company?.companyGroupId) {
      throw new Error(`Missing seeded Company ${persona.companyCode}.`);
    }
    if (!persona.branchCode || !profile.departmentCode) {
      throw new Error(`${persona.key} is missing its Branch or Department.`);
    }
    const branch = await tx.branch.findUnique({
      where: {
        companyId_branchCode: {
          companyId: company.id,
          branchCode: persona.branchCode,
        },
      },
      select: { id: true, companyId: true },
    });
    if (!branch || branch.companyId !== company.id) {
      throw new Error(`Missing seeded Branch ${persona.branchCode}.`);
    }
    const department = await tx.department.findUnique({
      where: {
        branchId_departmentCode: {
          branchId: branch.id,
          departmentCode: profile.departmentCode,
        },
      },
      select: { id: true, companyId: true, branchId: true },
    });
    if (
      !department ||
      department.companyId !== company.id ||
      department.branchId !== branch.id
    ) {
      throw new Error(`Missing seeded Department ${profile.departmentCode}.`);
    }
    const designation = persona.designationCode
      ? await tx.designation.findUnique({
          where: {
            companyId_designationCode: {
              companyId: company.id,
              designationCode: persona.designationCode,
            },
          },
          select: { id: true, companyId: true },
        })
      : null;
    if (
      persona.designationCode &&
      (!designation || designation.companyId !== company.id)
    ) {
      throw new Error(`Missing seeded Designation ${persona.designationCode}.`);
    }
    contexts.set(profile.personaKey, {
      companyGroupId: company.companyGroupId,
      companyId: company.id,
      branchId: branch.id,
      departmentId: department.id,
      designationId: designation?.id ?? null,
    });
  }
  return contexts;
}

async function seedEmployees(
  tx: Prisma.TransactionClient,
  contexts: Map<string, PersonaContext>,
  employeeStats: SeedStats,
  reportingStats: SeedStats,
): Promise<Map<string, string>> {
  const employeeIds = new Map<string, string>();
  const personaByKey = new Map(
    REFERENCE_DATA_CONTRACT.personas.map((persona) => [persona.key, persona]),
  );

  for (const profile of provisioningProfiles()) {
    const persona = personaByKey.get(profile.personaKey);
    const context = contexts.get(profile.personaKey);
    if (!persona || !context) {
      throw new Error(`Missing resolved persona ${profile.personaKey}.`);
    }
    if (!persona.employeeRecord) {
      continue;
    }
    if (
      !profile.employeeCode ||
      !context.companyId ||
      !context.branchId ||
      !context.departmentId
    ) {
      throw new Error(`${persona.key} has an incomplete Employee scope.`);
    }
    const employeeActive = !profile.userRecord || persona.loginEnabled;
    const existing = await tx.employee.findUnique({
      where: { employeeCode: profile.employeeCode },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        departmentId: true,
        designationId: true,
        firstName: true,
        lastName: true,
        email: true,
        joiningDate: true,
        employeeType: true,
        employmentStatus: true,
        creationSource: true,
        sourceCandidateId: true,
        isActive: true,
      },
    });
    const desired = {
      companyId: context.companyId,
      branchId: context.branchId,
      departmentId: context.departmentId,
      designationId: context.designationId,
      firstName: 'QA',
      lastName: displayName(persona.key).slice(3),
      email: persona.email,
      joiningDate: REFERENCE_EFFECTIVE_AT,
      employeeType: 'PERMANENT',
      employmentStatus: employeeActive ? 'ACTIVE' : 'TERMINATED',
      creationSource: EmployeeCreationSource.MANUAL,
      isActive: employeeActive,
    };
    if (!existing) {
      const created = await tx.employee.create({
        data: { employeeCode: profile.employeeCode, ...desired },
        select: { id: true },
      });
      employeeIds.set(persona.key, created.id);
      record(employeeStats, 'created');
    } else {
      if (
        existing.companyId !== context.companyId ||
        existing.branchId !== context.branchId ||
        existing.departmentId !== context.departmentId ||
        existing.designationId !== context.designationId ||
        existing.sourceCandidateId !== null ||
        existing.creationSource !== EmployeeCreationSource.MANUAL
      ) {
        throw new Error(
          `${profile.employeeCode} collides with an Employee outside its contracted QA scope.`,
        );
      }
      employeeIds.set(persona.key, existing.id);
      if (changed(existing, desired)) {
        await tx.employee.update({
          where: { id: existing.id },
          data: desired,
        });
        record(employeeStats, 'updated');
      } else {
        record(employeeStats, 'unchanged');
      }
    }
  }

  for (const profile of provisioningProfiles()) {
    if (!profile.managerPersonaKey || !profile.employeeCode) {
      continue;
    }
    const employeeId = employeeIds.get(profile.personaKey);
    const managerId = employeeIds.get(profile.managerPersonaKey);
    if (!employeeId || !managerId) {
      throw new Error(
        `${profile.personaKey} has an unresolved reporting manager.`,
      );
    }
    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      select: { managerId: true },
    });
    if (!employee) {
      throw new Error(`Missing seeded Employee ${profile.employeeCode}.`);
    }
    if (employee.managerId === managerId) {
      record(reportingStats, 'unchanged');
    } else {
      await tx.employee.update({
        where: { id: employeeId },
        data: { managerId },
      });
      record(reportingStats, 'updated');
    }
  }

  return employeeIds;
}

async function seedUsers(
  tx: Prisma.TransactionClient,
  plaintextPassword: string,
  passwordHash: string,
  options: ReferencePersonaSeedOptions,
  contexts: Map<string, PersonaContext>,
  employeeIds: Map<string, string>,
  stats: SeedStats,
): Promise<Map<string, string>> {
  const userIds = new Map<string, string>();
  const personaByKey = new Map(
    REFERENCE_DATA_CONTRACT.personas.map((persona) => [persona.key, persona]),
  );

  for (const profile of provisioningProfiles()) {
    const persona = personaByKey.get(profile.personaKey);
    const context = contexts.get(profile.personaKey);
    if (!persona || !context) {
      throw new Error(`Missing resolved persona ${profile.personaKey}.`);
    }
    const employeeId = employeeIds.get(profile.personaKey) ?? null;
    if (!profile.userRecord) {
      if (employeeId) {
        const [linkedUser, emailUser] = await Promise.all([
          tx.user.findUnique({
            where: { employeeId },
            select: { id: true },
          }),
          tx.user.findUnique({
            where: { normalizedEmail: normalize(persona.email) },
            select: { id: true },
          }),
        ]);
        if (linkedUser || emailUser) {
          throw new Error(
            `${persona.key} must remain an Employee without a User login.`,
          );
        }
      }
      continue;
    }
    if (!profile.username) {
      throw new Error(`${persona.key} is missing its QA username.`);
    }
    const normalizedUsername = normalize(profile.username);
    const normalizedEmail = normalize(persona.email);
    const [byUsername, byEmail, byEmployee] = await Promise.all([
      tx.user.findUnique({
        where: { normalizedUsername },
        select: {
          id: true,
          username: true,
          normalizedUsername: true,
          displayName: true,
          email: true,
          normalizedEmail: true,
          emailVerifiedAt: true,
          passwordHash: true,
          status: true,
          mustChangePassword: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          employeeId: true,
          defaultCompanyGroupId: true,
          defaultCompanyId: true,
          defaultBranchId: true,
        },
      }),
      tx.user.findUnique({
        where: { normalizedEmail },
        select: { id: true },
      }),
      employeeId
        ? tx.user.findUnique({
            where: { employeeId },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (
      (byEmail && byUsername?.id !== byEmail.id) ||
      (byEmployee && byUsername?.id !== byEmployee.id)
    ) {
      throw new Error(
        `${persona.key} collides with another User email or Employee link.`,
      );
    }

    const desired = {
      username: profile.username,
      normalizedUsername,
      displayName: displayName(persona.key),
      email: persona.email,
      normalizedEmail,
      emailVerifiedAt: REFERENCE_EFFECTIVE_AT,
      status: persona.loginEnabled ? UserStatus.ACTIVE : UserStatus.DISABLED,
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      employeeId,
      defaultCompanyGroupId: context.companyGroupId,
      defaultCompanyId: context.companyId,
      defaultBranchId: context.branchId,
    };
    if (!byUsername) {
      const created = await tx.user.create({
        data: {
          ...desired,
          passwordHash: persona.loginEnabled
            ? passwordHash
            : DISABLED_QA_ACTOR_PASSWORD_MARKER,
        },
        select: { id: true },
      });
      userIds.set(persona.key, created.id);
      record(stats, 'created');
      continue;
    }
    if (byUsername.employeeId !== employeeId) {
      throw new Error(
        `${persona.key} collides with a User linked to another Employee.`,
      );
    }
    if (
      persona.loginEnabled &&
      !byUsername.passwordHash?.startsWith(ARGON2_HASH_PREFIX)
    ) {
      throw new Error(
        `${persona.key} has no valid Argon2 credential; refusing to activate or overwrite it.`,
      );
    }
    const credentialNeedsRotation =
      persona.loginEnabled &&
      !(await verify(byUsername.passwordHash!, plaintextPassword));
    if (credentialNeedsRotation && !options.allowCredentialRotation) {
      throw new Error(
        `${persona.key} uses a different QA credential. Re-run with the explicit persona credential rotation option while the application is stopped.`,
      );
    }
    if (credentialNeedsRotation) {
      const challengeCutoff = new Date();
      const [activeSessions, pendingResets, pendingInvitations] =
        await Promise.all([
          tx.authSession.count({
            where: { userId: byUsername.id, revokedAt: null },
          }),
          tx.passwordResetChallenge.count({
            where: buildUnexpiredPendingCredentialChallengeWhere(
              byUsername.id,
              challengeCutoff,
            ),
          }),
          tx.userInvitation.count({
            where: buildUnexpiredPendingCredentialChallengeWhere(
              byUsername.id,
              challengeCutoff,
            ),
          }),
        ]);
      if (activeSessions > 0 || pendingResets > 0 || pendingInvitations > 0) {
        throw new Error(
          `${persona.key} has active authentication state. Revoke its sessions and pending challenges through the application before rotating the QA credential.`,
        );
      }
    }
    const desiredWithCredential = persona.loginEnabled
      ? credentialNeedsRotation
        ? { ...desired, passwordHash }
        : desired
      : {
          ...desired,
          passwordHash: DISABLED_QA_ACTOR_PASSWORD_MARKER,
        };
    userIds.set(persona.key, byUsername.id);
    if (changed(byUsername, desiredWithCredential)) {
      await tx.user.update({
        where: { id: byUsername.id },
        data: {
          ...desiredWithCredential,
          ...(credentialNeedsRotation ||
          (!persona.loginEnabled && byUsername.status !== UserStatus.DISABLED)
            ? { securityVersion: { increment: 1 } }
            : {}),
        },
      });
      record(stats, 'updated');
    } else {
      record(stats, 'unchanged');
    }
  }
  return userIds;
}

async function seedRoleAssignments(
  tx: Prisma.TransactionClient,
  roleIds: Map<string, string>,
  contexts: Map<string, PersonaContext>,
  userIds: Map<string, string>,
  stats: SeedStats,
): Promise<void> {
  for (const profile of provisioningProfiles()) {
    if (!profile.userRecord) {
      continue;
    }
    const userId = userIds.get(profile.personaKey);
    const context = contexts.get(profile.personaKey);
    if (!userId || !context) {
      throw new Error(`Missing seeded User ${profile.personaKey}.`);
    }
    const desiredAssignments = profile.roleAssignments.map((assignment) => {
      const roleId = roleIds.get(assignment.roleName);
      if (!roleId) {
        throw new Error(`Missing Role ${assignment.roleName}.`);
      }
      return buildRoleAssignmentData(roleId, assignment.scope, context);
    });
    const desiredKeys = new Set(
      desiredAssignments.map(
        (assignment) => `${assignment.roleId}:${assignment.scopeKey}`,
      ),
    );
    const existingAssignments = await tx.userRoleAssignment.findMany({
      where: { userId },
      select: {
        id: true,
        roleId: true,
        scope: true,
        scopeKey: true,
        companyGroupId: true,
        companyId: true,
        branchId: true,
        isActive: true,
      },
    });
    for (const existing of existingAssignments) {
      const key = `${existing.roleId}:${existing.scopeKey}`;
      if (!desiredKeys.has(key) && existing.isActive) {
        await tx.userRoleAssignment.update({
          where: { id: existing.id },
          data: { isActive: false },
        });
        record(stats, 'updated');
      }
    }
    for (const desired of desiredAssignments) {
      const existing = existingAssignments.find(
        (assignment) =>
          assignment.roleId === desired.roleId &&
          assignment.scopeKey === desired.scopeKey,
      );
      const desiredWithStatus = { ...desired, isActive: true };
      if (!existing) {
        await tx.userRoleAssignment.create({
          data: { userId, ...desiredWithStatus },
        });
        record(stats, 'created');
      } else if (changed(existing, desiredWithStatus)) {
        await tx.userRoleAssignment.update({
          where: { id: existing.id },
          data: desiredWithStatus,
        });
        record(stats, 'updated');
      } else {
        record(stats, 'unchanged');
      }
    }
  }
}

async function seedDepartmentGrants(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  contexts: Map<string, PersonaContext>,
  userIds: Map<string, string>,
  stats: SeedStats,
): Promise<void> {
  for (const grant of REFERENCE_DATA_CONTRACT.personaProvisioning
    .departmentGrants) {
    const context = contexts.get(grant.personaKey);
    const userId = userIds.get(grant.personaKey);
    if (
      !context?.companyId ||
      !context.branchId ||
      !context.departmentId ||
      !userId
    ) {
      throw new Error(
        `${grant.personaKey} has an unresolved Department grant.`,
      );
    }
    const existing = await tx.departmentAssetGrant.findUnique({
      where: {
        userId_departmentId: { userId, departmentId: context.departmentId },
      },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        departmentId: true,
        userId: true,
        grantedByUserId: true,
        grantedAt: true,
        revokedAt: true,
        revokedByUserId: true,
      },
    });
    const desired = {
      companyId: context.companyId,
      branchId: context.branchId,
      departmentId: context.departmentId,
      userId,
      grantedByUserId: actorUserId,
      grantedAt: REFERENCE_EFFECTIVE_AT,
      revokedAt: null,
      revokedByUserId: null,
    };
    if (!existing) {
      await tx.departmentAssetGrant.create({ data: desired });
      record(stats, 'created');
    } else if (changed(existing, desired)) {
      await tx.departmentAssetGrant.update({
        where: { id: existing.id },
        data: { ...desired, version: { increment: 1 } },
      });
      record(stats, 'updated');
    } else {
      record(stats, 'unchanged');
    }
  }
}

export async function seedReferencePersonas(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  plaintextPassword: string,
  options: ReferencePersonaSeedOptions = {},
): Promise<ReferencePersonaSeedResult> {
  const layers = createLayerStats();
  validateReferencePersonaPassword(plaintextPassword);
  const passwordHash = await hash(plaintextPassword, {
    type: 2,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const contexts = await resolvePersonaContexts(tx);
  const roleIds = await seedRoles(tx, layers['custom-roles-and-permissions']);
  const employeeIds = await seedEmployees(
    tx,
    contexts,
    layers['stable-employees'],
    layers['reporting-lines'],
  );
  const userIds = await seedUsers(
    tx,
    plaintextPassword,
    passwordHash,
    options,
    contexts,
    employeeIds,
    layers['stable-users'],
  );
  await seedRoleAssignments(
    tx,
    roleIds,
    contexts,
    userIds,
    layers['scoped-role-assignments'],
  );
  await seedDepartmentGrants(
    tx,
    actorUserId,
    contexts,
    userIds,
    layers['department-asset-grants'],
  );

  const personas: ReadonlyArray<ReferencePersona> =
    REFERENCE_DATA_CONTRACT.personas;
  const profiles = provisioningProfiles();
  return {
    layers,
    totals: sumStats(Object.values(layers)),
    personaCounts: {
      profiles: profiles.length,
      users: profiles.filter((profile) => profile.userRecord).length,
      employees: personas.filter((persona) => persona.employeeRecord).length,
      enabledLogins: personas.filter((persona) => persona.loginEnabled).length,
      disabledLogins: profiles.filter((profile) => {
        const persona = personas.find(
          (candidate) => candidate.key === profile.personaKey,
        );
        return profile.userRecord && persona?.loginEnabled === false;
      }).length,
      employeeWithoutLogin: profiles.filter(
        (profile) => !profile.userRecord && profile.employeeCode !== null,
      ).length,
    },
  };
}
