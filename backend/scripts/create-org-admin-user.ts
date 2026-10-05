/**
 * Emergency recovery: create an ACTIVE login for an existing organization.
 *
 * Does NOT create a shared default admin. Requires explicit env values.
 * Prefer Administration → Users when any admin can still sign in.
 *
 * From backend/:
 *
 *   $env:COMPANY_NAME="VTRIOS"
 *   $env:EMAIL="manager@example.com"
 *   $env:DISPLAY_NAME="VTRIOS Manager"
 *   $env:PASSWORD="<temporary-password-from-your-secret-store>"
 *   $env:ROLE_CODE="COMPANY_ADMINISTRATOR"   # or ORGANIZATION_OWNER
 *   pnpm run ops:recovery:create-org-admin
 *
 * Optional:
 *   COMPANY_CODE=...
 *   USERNAME=...
 *   BRANCH_CODE=...
 */
import { randomBytes } from 'node:crypto';

import { hash } from 'argon2';
import { Prisma, RoleScope, UserStatus } from '@prisma/client';

import { createPrismaClient } from './create-prisma-client';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function generateUsername(
  displayName: string,
  normalizedEmail: string,
): string {
  const source = displayName || normalizedEmail.split('@')[0] || 'user';
  const base =
    source
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}]+/gu, '.')
      .replace(/^\.+|\.+$/g, '')
      .toLocaleLowerCase('en-US')
      .slice(0, 48) || 'user';

  return `${base}.${randomBytes(3).toString('hex')}`;
}

function generatePassword(): string {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const random = randomBytes(20);
  return Array.from(random, (value) => alphabet[value % alphabet.length]).join(
    '',
  );
}

function validatePassword(password: string, email: string, username: string) {
  if (password.length < 12 || password.length > 128) {
    throw new Error('PASSWORD must be between 12 and 128 characters.');
  }
  const lowered = password.trim().toLowerCase();
  if (lowered === email.toLowerCase() || lowered === username.toLowerCase()) {
    throw new Error('PASSWORD must not match email or username.');
  }
}

async function main() {
  const companyName = optional('COMPANY_NAME');
  const companyCode = optional('COMPANY_CODE');
  if (!companyName && !companyCode) {
    throw new Error('Set COMPANY_NAME and/or COMPANY_CODE (example: VTRIOS).');
  }

  const email = required('EMAIL');
  const displayName =
    optional('DISPLAY_NAME') ?? email.split('@')[0] ?? 'Admin';
  const roleCode = optional('ROLE_CODE') ?? 'COMPANY_ADMINISTRATOR';
  const branchCode = optional('BRANCH_CODE');

  const normalizedEmail = normalize(email);
  const username =
    optional('USERNAME') ?? generateUsername(displayName, normalizedEmail);
  const normalizedUsername = normalize(username);
  const password = optional('PASSWORD') ?? generatePassword();
  validatePassword(password, email, username);

  const { prisma, disconnect } = await createPrismaClient();

  try {
    const companyFilters: Prisma.CompanyWhereInput[] = [];
    if (companyCode) {
      companyFilters.push({
        companyCode: { equals: companyCode, mode: 'insensitive' },
      });
    }
    if (companyName) {
      companyFilters.push({
        companyName: { contains: companyName, mode: 'insensitive' },
      });
    }

    const companies = await prisma.company.findMany({
      where: {
        isActive: true,
        OR: companyFilters,
      },
      include: {
        companyGroup: true,
        branches: {
          where: { isActive: true },
          orderBy: { branchName: 'asc' },
          take: 20,
        },
      },
      take: 10,
    });

    if (companies.length === 0) {
      throw new Error(
        `No active company matched COMPANY_NAME=${companyName ?? '-'} COMPANY_CODE=${companyCode ?? '-'}.`,
      );
    }
    if (companies.length > 1) {
      const list = companies
        .map((c) => `${c.companyCode} | ${c.companyName}`)
        .join('\n  ');
      throw new Error(
        `Multiple companies matched. Pass COMPANY_CODE for one of:\n  ${list}`,
      );
    }

    const company = companies[0];
    const branch = branchCode
      ? company.branches.find(
          (b) => b.branchCode.toLowerCase() === branchCode.toLowerCase(),
        )
      : company.branches[0];

    if (branchCode && !branch) {
      throw new Error(
        `BRANCH_CODE=${branchCode} not found under ${company.companyCode}.`,
      );
    }

    const role = await prisma.role.findUnique({
      where: { code: roleCode },
      select: { id: true, code: true, isActive: true },
    });
    if (!role?.isActive) {
      throw new Error(`Role ${roleCode} is missing or inactive.`);
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ normalizedUsername }, { normalizedEmail }],
      },
      select: { id: true, username: true, email: true, status: true },
    });
    if (existing) {
      throw new Error(
        `User already exists: ${existing.username} / ${existing.email} (${existing.status}).`,
      );
    }

    const passwordHash = await hash(password, {
      type: 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    const useGroupScope = Boolean(company.companyGroupId);
    const scope = useGroupScope ? RoleScope.COMPANY_GROUP : RoleScope.COMPANY;
    const scopeKey = useGroupScope
      ? `COMPANY_GROUP:${company.companyGroupId}`
      : `COMPANY:${company.id}`;

    const now = new Date();
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username,
          normalizedUsername,
          displayName,
          email,
          normalizedEmail,
          emailVerifiedAt: now,
          passwordHash,
          status: UserStatus.ACTIVE,
          mustChangePassword: true,
          passwordChangedAt: now,
          defaultCompanyGroupId: company.companyGroupId,
          defaultCompanyId: company.id,
          defaultBranchId: branch?.id,
        },
      });

      await tx.userRoleAssignment.create({
        data: {
          userId: created.id,
          roleId: role.id,
          scope,
          scopeKey,
          companyGroupId: useGroupScope ? company.companyGroupId : null,
          companyId: useGroupScope ? null : company.id,
          branchId: null,
          isActive: true,
        },
      });

      await tx.securityEvent.create({
        data: {
          userId: created.id,
          type: 'USER_STATUS_CHANGED',
          metadata: {
            source: 'scripts/create-org-admin-user.ts',
            reason: 'emergency_org_admin_recovery',
            companyId: company.id,
            companyCode: company.companyCode,
            roleCode: role.code,
          },
        },
      });

      return created;
    });

    console.log('Created ACTIVE org admin user.');
    console.log(`Company:  ${company.companyCode} — ${company.companyName}`);
    if (company.companyGroup) {
      console.log(
        `Group:    ${company.companyGroup.groupCode} — ${company.companyGroup.groupName}`,
      );
    }
    if (branch) {
      console.log(`Branch:   ${branch.branchCode} — ${branch.branchName}`);
    }
    console.log(`Role:     ${role.code} (${scope})`);
    console.log(`Username: ${user.username}`);
    console.log(`Email:    ${user.email}`);
    console.log(`Password: ${password}`);
    console.log(
      'User must change password on first login (mustChangePassword=true).',
    );
    console.log(
      'Share these credentials securely and rotate after first login.',
    );
  } finally {
    await disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
