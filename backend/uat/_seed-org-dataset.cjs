/**
 * Seeds §2.2 Organization dataset only (Company Groups → Users/Employees).
 * Shifts are seeded by seedOrg but not verified here (per current request).
 */
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { config } = require('dotenv');
const { RoleScope, UserStatus } = require('@prisma/client');

config({ path: resolve(process.cwd(), '.env') });

const DEFAULT_UAT_PASSWORD = (process.env.UAT_DEFAULT_PASSWORD || '').trim();

if (!DEFAULT_UAT_PASSWORD) {
  throw new Error(
    'UAT_DEFAULT_PASSWORD is required. Supply it through the QA secret store; no fallback password is permitted.',
  );
}

function ensureEnvUat() {
  const envUatPath = resolve(process.cwd(), '.env.uat');
  if (existsSync(envUatPath)) {
    return;
  }

  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  const databaseSchema = (process.env.DATABASE_SCHEMA || 'dsp_pms').trim();
  const sslMode = (process.env.DATABASE_SSL_MODE || '').trim();
  const sslCa = (process.env.DATABASE_SSL_CA || '').trim();
  const platformAdmin =
    (process.env.UAT_PLATFORM_ADMIN_USERNAME || '').trim() ||
    'arockiajebins.6967b5e6';

  const lines = [
    'NODE_ENV=development',
    'ALLOW_AWS_UAT_AUTOMATION=true',
    `DATABASE_URL=${databaseUrl}`,
    `DATABASE_SCHEMA=${databaseSchema}`,
    sslMode ? `DATABASE_SSL_MODE=${sslMode}` : '',
    sslCa ? `DATABASE_SSL_CA=${sslCa}` : '',
    `UAT_PLATFORM_ADMIN_USERNAME=${platformAdmin}`,
    `UAT_DEFAULT_PASSWORD=${DEFAULT_UAT_PASSWORD}`,
    '',
  ].filter(Boolean);

  writeFileSync(envUatPath, lines.join('\n'), 'utf8');
  console.log(`Created ${envUatPath}`);
}

async function ensurePlatformAdmin(prisma, username, normalizeIdentity) {
  const normalizedUsername = normalizeIdentity(username);
  const user = await prisma.user.findUnique({
    where: { normalizedUsername },
  });
  if (!user) {
    throw new Error(
      `Platform admin user "${username}" not found. Create/login first or set UAT_PLATFORM_ADMIN_USERNAME.`,
    );
  }

  const role = await prisma.role.findUnique({
    where: { code: 'SUPER_ADMINISTRATOR' },
  });
  if (!role) {
    throw new Error('SUPER_ADMINISTRATOR role missing — run migrations.');
  }

  const existing = await prisma.userRoleAssignment.findUnique({
    where: {
      userId_roleId_scopeKey: {
        userId: user.id,
        roleId: role.id,
        scopeKey: 'GLOBAL',
      },
    },
  });

  if (!existing) {
    await prisma.userRoleAssignment.create({
      data: {
        userId: user.id,
        roleId: role.id,
        scope: RoleScope.GLOBAL,
        scopeKey: 'GLOBAL',
        companyGroupId: null,
        companyId: null,
        branchId: null,
        isActive: true,
      },
    });
    console.log(`Assigned SUPER_ADMINISTRATOR (GLOBAL) to ${username}`);
  } else if (!existing.isActive) {
    await prisma.userRoleAssignment.update({
      where: { id: existing.id },
      data: { isActive: true },
    });
    console.log(`Re-activated SUPER_ADMINISTRATOR for ${username}`);
  } else {
    console.log(`Platform admin role already present for ${username}`);
  }

  if (user.status === UserStatus.LOCKED || user.failedLoginAttempts > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    console.log(`Unlocked platform admin ${username}`);
  }
}

async function main() {
  ensureEnvUat();

  const {
    loadUatEnv,
    ATLAS_GROUP_CODE,
    BEACON_GROUP_CODE,
  } = require('../dist/uat/lib/safety.js');
  const { createUatPrisma } = require('../dist/uat/lib/prisma-client.js');
  const { hashUatPassword } = require('../dist/uat/lib/password.js');
  const { normalizeIdentity } = require('../dist/uat/lib/normalize.js');
  const { emptySeedIds } = require('../dist/uat/seed/context.js');
  const { seedOrg } = require('../dist/uat/seed/org.js');
  const { seedEmployees } = require('../dist/uat/seed/employees.js');
  const { seedUsers } = require('../dist/uat/seed/users.js');

  const env = loadUatEnv();
  const handle = createUatPrisma(env);

  try {
    await ensurePlatformAdmin(
      handle.prisma,
      env.platformAdminUsername,
      normalizeIdentity,
    );

    const passwordHash = await hashUatPassword(env.defaultPassword);
    const ctx = {
      prisma: handle.prisma,
      ids: emptySeedIds(),
      passwordHash,
      log: (message) => console.log(message),
    };

    console.log('Seeding §2.2 organization dataset…');
    await seedOrg(ctx);
    await seedEmployees(ctx);
    await seedUsers(ctx);

    const groups = await handle.prisma.companyGroup.findMany({
      where: { groupCode: { in: [ATLAS_GROUP_CODE, BEACON_GROUP_CODE] } },
      select: { groupCode: true, groupName: true },
    });
    console.log('Seed complete. Groups:', groups);
    console.log(
      `UAT login password is set from UAT_DEFAULT_PASSWORD in .env.uat (length ${env.defaultPassword.length}).`,
    );
  } finally {
    await handle.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
