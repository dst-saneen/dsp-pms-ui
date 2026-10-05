import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const EXPECTED = {
  companyGroups: 2,
  companies: 4,
  companiesInactive: 1,
  branches: 5,
  branchesInactive: 1,
  departments: 8,
  designations: 10,
  usersCreated: 17, // +1 platform admin = 18 program total
  employees: 20,
  empActive: 14,
  empProbation: 3,
  empNotice: 1,
  empTerminated: 1,
  empResigned: 1,
};

function fail(msg) {
  console.error('ERROR:', msg);
  process.exitCode = 1;
}

async function main() {
  const rawUrl = (process.env.DATABASE_URL || '').trim();
  if (!rawUrl) fail('DATABASE_URL missing');
  const schema = (process.env.DATABASE_SCHEMA || '').trim() || 'dsp_pms';
  const databaseUrl = rawUrl.replace(/^postgres(?:ql)?\+asyncpg:\/\//i, 'postgresql://');
  const runtimeUrl = new URL(databaseUrl);
  runtimeUrl.searchParams.delete('schema');
  runtimeUrl.searchParams.delete('sslmode');

  const ssl = process.env.DATABASE_SSL_CA
    ? {
        ca: readFileSync(resolve(process.cwd(), process.env.DATABASE_SSL_CA), 'utf8'),
        rejectUnauthorized: true,
      }
    : { rejectUnauthorized: false };

  const pool = new Pool({
    connectionString: runtimeUrl.toString(),
    max: 3,
    connectionTimeoutMillis: 20000,
    ssl,
    options: `-c search_path=${schema}`,
  });
  const adapter = new PrismaPg(pool, { schema, disposeExternalPool: true });
  const prisma = new PrismaClient({ adapter });

  try {
    const groups = await prisma.companyGroup.findMany({
      where: { groupCode: { in: ['UAT-ATLAS', 'UAT-BEACON'] } },
      orderBy: { groupCode: 'asc' },
    });

    console.log('\n=== §2.2 Organization dataset verification (excl. Shifts) ===\n');

    if (groups.length === 0) {
      const any = await prisma.companyGroup.findMany({
        where: { groupCode: { startsWith: 'UAT-' } },
        select: { groupCode: true, groupName: true },
      });
      console.log('No UAT-ATLAS / UAT-BEACON groups found.');
      console.log('Other UAT groups:', any);
      fail('Baseline UAT company groups missing — seed not applied or incomplete.');
      return;
    }

    const groupIds = groups.map((g) => g.id);
    const companies = await prisma.company.findMany({
      where: { companyGroupId: { in: groupIds } },
      orderBy: { companyCode: 'asc' },
    });
    const companyIds = companies.map((c) => c.id);

    const branches = await prisma.branch.findMany({
      where: { companyId: { in: companyIds } },
      orderBy: { branchCode: 'asc' },
    });
    const departments = await prisma.department.findMany({
      where: { companyId: { in: companyIds } },
      orderBy: { departmentCode: 'asc' },
    });
    const designations = await prisma.designation.findMany({
      where: { companyId: { in: companyIds } },
      orderBy: { designationCode: 'asc' },
    });
    const employees = await prisma.employee.findMany({
      where: { employeeCode: { startsWith: 'UAT-EMP-' } },
      orderBy: { employeeCode: 'asc' },
      include: { user: { select: { id: true, username: true } } },
    });
    const users = await prisma.user.findMany({
      where: { username: { startsWith: 'uat.' } },
      orderBy: { username: 'asc' },
      select: {
        username: true,
        email: true,
        status: true,
        mustChangePassword: true,
        employeeId: true,
      },
    });

    const statusCounts = employees.reduce((acc, emp) => {
      acc[emp.employmentStatus] = (acc[emp.employmentStatus] ?? 0) + 1;
      return acc;
    }, {});

    const actual = {
      companyGroups: groups.length,
      companies: companies.length,
      companiesInactive: companies.filter((c) => !c.isActive).length,
      branches: branches.length,
      branchesInactive: branches.filter((b) => !b.isActive).length,
      departments: departments.length,
      designations: designations.length,
      usersCreated: users.length,
      employees: employees.length,
      empActive: statusCounts.ACTIVE ?? 0,
      empProbation: statusCounts.PROBATION ?? 0,
      empNotice: statusCounts.NOTICE ?? 0,
      empTerminated: statusCounts.TERMINATED ?? 0,
      empResigned: statusCounts.RESIGNED ?? 0,
    };

    const rows = [
      ['Company Groups', EXPECTED.companyGroups, actual.companyGroups],
      ['Companies', EXPECTED.companies, actual.companies],
      ['Companies inactive', EXPECTED.companiesInactive, actual.companiesInactive],
      ['Branches', EXPECTED.branches, actual.branches],
      ['Branches inactive', EXPECTED.branchesInactive, actual.branchesInactive],
      ['Departments', EXPECTED.departments, actual.departments],
      ['Designations', EXPECTED.designations, actual.designations],
      ['Users (uat.* seeded)', EXPECTED.usersCreated, actual.usersCreated],
      ['Employees', EXPECTED.employees, actual.employees],
      ['Employees ACTIVE', EXPECTED.empActive, actual.empActive],
      ['Employees PROBATION', EXPECTED.empProbation, actual.empProbation],
      ['Employees NOTICE', EXPECTED.empNotice, actual.empNotice],
      ['Employees TERMINATED', EXPECTED.empTerminated, actual.empTerminated],
      ['Employees RESIGNED', EXPECTED.empResigned, actual.empResigned],
    ];

    const issues = [];
    console.log('Data'.padEnd(28), 'Expected'.padStart(10), 'Actual'.padStart(10), 'Status');
    console.log('-'.repeat(60));
    for (const [label, exp, act] of rows) {
      const ok = exp === act;
      console.log(label.padEnd(28), String(exp).padStart(10), String(act).padStart(10), ok ? 'OK' : 'MISMATCH');
      if (!ok) issues.push(`${label}: expected ${exp}, got ${act}`);
    }

    console.log('\n--- Detail ---');
    console.log('Groups:', groups.map((g) => `${g.groupCode} (${g.groupName})`));
    console.log(
      'Companies:',
      companies.map((c) => `${c.companyCode} active=${c.isActive}`),
    );
    console.log(
      'Branches:',
      branches.map((b) => `${b.branchCode} active=${b.isActive}`),
    );
    console.log(
      'Departments:',
      departments.map((d) => d.departmentCode),
    );
    console.log(
      'Designations:',
      designations.map((d) => d.designationCode),
    );
    console.log(
      'Employees:',
      employees.map((e) => `${e.employeeCode} ${e.employmentStatus} user=${e.user?.username ?? 'none'}`),
    );
    console.log(
      'Users:',
      users.map((u) => `${u.username} ${u.status} mcp=${u.mustChangePassword}`),
    );

    const noLogin = employees.find((e) => e.employeeCode === 'UAT-EMP-A16');
    if (!noLogin) {
      issues.push('Missing employee UAT-EMP-A16 (no-login case)');
    } else if (noLogin.user) {
      issues.push('UAT-EMP-A16 should have no login user');
    }

    const disabled = users.find((u) => u.username === 'uat.atlas.disabled');
    if (disabled && disabled.status !== 'DISABLED') {
      issues.push('uat.atlas.disabled should be DISABLED');
    }
    const mustChange = users.find((u) => u.username === 'uat.beacon.mustchange');
    if (mustChange && mustChange.mustChangePassword !== true) {
      issues.push('uat.beacon.mustchange should require password change');
    }

    // Reference integrity for employees
    for (const emp of employees) {
      if (!companyIds.includes(emp.companyId)) {
        issues.push(`${emp.employeeCode}: companyId not in UAT companies`);
      }
    }

    console.log('\n=== Result ===');
    if (issues.length === 0) {
      console.log('PASS: Organization dataset matches §2.2 (Shifts excluded).');
    } else {
      console.log(`FAIL: ${issues.length} issue(s):`);
      for (const issue of issues) console.log(' -', issue);
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
