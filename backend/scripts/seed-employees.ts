import { randomUUID } from 'node:crypto';

import { createPrismaClient } from './create-prisma-client';

type SeedEmployee = {
  employeeCode: string;
  companyCode: string;
  departmentName: string;
  designationName: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  joiningDate: string;
  employeeType: string;
  employmentStatus: string;
  managerCode?: string;
};

const kowdiarDesignations = [
  {
    designationCode: 'DES-000002',
    designationName: 'Project Manager',
    level: 10,
  },
  { designationCode: 'DES-000003', designationName: 'Data Engineer', level: 5 },
  {
    designationCode: 'DES-000004',
    designationName: 'Business Analyst',
    level: 4,
  },
  { designationCode: 'DES-000005', designationName: 'AI Engineer', level: 6 },
];

const employees: SeedEmployee[] = [
  // Datascape Technology TVM — 5
  {
    employeeCode: 'EMP-000001',
    companyCode: 'COM-000001',
    departmentName: 'Software Development / Engineering',
    designationName: 'Delivery Manager',
    firstName: 'Arjun',
    lastName: 'Nair',
    email: 'arjun.nair@datascape.local',
    mobile: '9876500001',
    joiningDate: '2021-03-15',
    employeeType: 'PERMANENT',
    employmentStatus: 'ACTIVE',
  },
  {
    employeeCode: 'EMP-000002',
    companyCode: 'COM-000001',
    departmentName: 'Software Development / Engineering',
    designationName: 'Software Engineer',
    firstName: 'Meera',
    lastName: 'Krishnan',
    email: 'meera.krishnan@datascape.local',
    mobile: '9876500002',
    joiningDate: '2022-06-01',
    employeeType: 'PERMANENT',
    employmentStatus: 'ACTIVE',
    managerCode: 'EMP-000001',
  },
  {
    employeeCode: 'EMP-000003',
    companyCode: 'COM-000001',
    departmentName: 'Quality Assurance (QA) / Testing',
    designationName: 'QA Engineer',
    firstName: 'Rohan',
    lastName: 'Pillai',
    email: 'rohan.pillai@datascape.local',
    mobile: '9876500003',
    joiningDate: '2023-01-10',
    employeeType: 'PERMANENT',
    employmentStatus: 'ACTIVE',
    managerCode: 'EMP-000001',
  },
  {
    employeeCode: 'EMP-000004',
    companyCode: 'COM-000001',
    departmentName: 'UI/UX Design',
    designationName: 'Product Designer',
    firstName: 'Ananya',
    lastName: 'Menon',
    email: 'ananya.menon@datascape.local',
    mobile: '9876500004',
    joiningDate: '2023-08-21',
    employeeType: 'PERMANENT',
    employmentStatus: 'PROBATION',
    managerCode: 'EMP-000001',
  },
  {
    employeeCode: 'EMP-000005',
    companyCode: 'COM-000001',
    departmentName: 'DevOps / Cloud Infrastructure',
    designationName: 'Cloud Engineer',
    firstName: 'Vignesh',
    lastName: 'Rajan',
    email: 'vignesh.rajan@datascape.local',
    mobile: '9876500005',
    joiningDate: '2022-11-14',
    employeeType: 'CONTRACT',
    employmentStatus: 'ACTIVE',
    managerCode: 'EMP-000001',
  },

  // Datascape Technology Kowdiar — 5
  {
    employeeCode: 'EMP-000006',
    companyCode: 'COM-000002',
    departmentName: 'Business Analysis',
    designationName: 'Senior Business Analyst',
    firstName: 'Kavya',
    lastName: 'Suresh',
    email: 'kavya.suresh@datascape.local',
    mobile: '9876500006',
    joiningDate: '2020-09-01',
    employeeType: 'PERMANENT',
    employmentStatus: 'ACTIVE',
  },
  {
    employeeCode: 'EMP-000007',
    companyCode: 'COM-000002',
    departmentName: 'Project / Program Management',
    designationName: 'Project Manager',
    firstName: 'Aditya',
    lastName: 'Varma',
    email: 'aditya.varma@datascape.local',
    mobile: '9876500007',
    joiningDate: '2021-12-05',
    employeeType: 'PERMANENT',
    employmentStatus: 'ACTIVE',
    managerCode: 'EMP-000006',
  },
  {
    employeeCode: 'EMP-000008',
    companyCode: 'COM-000002',
    departmentName: 'Data & AI',
    designationName: 'Data Engineer',
    firstName: 'Sneha',
    lastName: 'Thomas',
    email: 'sneha.thomas@datascape.local',
    mobile: '9876500008',
    joiningDate: '2023-04-17',
    employeeType: 'PERMANENT',
    employmentStatus: 'ACTIVE',
    managerCode: 'EMP-000006',
  },
  {
    employeeCode: 'EMP-000009',
    companyCode: 'COM-000002',
    departmentName: 'Business Analysis',
    designationName: 'Business Analyst',
    firstName: 'Nikhil',
    lastName: 'Jose',
    email: 'nikhil.jose@datascape.local',
    mobile: '9876500009',
    joiningDate: '2024-02-12',
    employeeType: 'PERMANENT',
    employmentStatus: 'PROBATION',
    managerCode: 'EMP-000006',
  },
  {
    employeeCode: 'EMP-000010',
    companyCode: 'COM-000002',
    departmentName: 'Data & AI',
    designationName: 'AI Engineer',
    firstName: 'Priya',
    lastName: 'Das',
    email: 'priya.das@datascape.local',
    mobile: '9876500010',
    joiningDate: '2024-07-01',
    employeeType: 'CONTRACT',
    employmentStatus: 'ACTIVE',
    managerCode: 'EMP-000006',
  },
];

async function ensureNumberSeries(
  prisma: Awaited<ReturnType<typeof createPrismaClient>>['prisma'],
  entityType: string,
  scopeKey: string,
  prefix: string,
  minValue: number,
) {
  const existing = await prisma.numberSeries.findUnique({
    where: {
      entityType_scopeKey: {
        entityType,
        scopeKey,
      },
    },
  });

  if (!existing) {
    await prisma.numberSeries.create({
      data: {
        id: randomUUID(),
        entityType,
        scopeKey,
        prefix,
        currentValue: minValue,
      },
    });
    return;
  }

  if (existing.currentValue < minValue) {
    await prisma.numberSeries.update({
      where: { id: existing.id },
      data: { currentValue: minValue },
    });
  }
}

async function main() {
  const { prisma, disconnect } = await createPrismaClient();

  try {
    const companies = await prisma.company.findMany({
      where: {
        companyCode: {
          in: ['COM-000001', 'COM-000002'],
        },
      },
      include: {
        branches: true,
        departments: true,
        designations: true,
      },
    });

    if (companies.length < 2) {
      throw new Error(
        'Need both COM-000001 and COM-000002 companies before seeding employees.',
      );
    }

    const companyByCode = new Map(
      companies.map((company) => [company.companyCode, company]),
    );

    const kowdiar = companyByCode.get('COM-000002');
    if (!kowdiar) {
      throw new Error('COM-000002 (Kowdiar) company not found.');
    }

    for (const designation of kowdiarDesignations) {
      const existing = kowdiar.designations.find(
        (item) =>
          item.designationCode === designation.designationCode ||
          item.designationName === designation.designationName,
      );

      if (existing) {
        continue;
      }

      await prisma.designation.create({
        data: {
          companyId: kowdiar.id,
          designationCode: designation.designationCode,
          designationName: designation.designationName,
          level: designation.level,
          isActive: true,
        },
      });
    }

    // Refresh designations after inserts
    const refreshedCompanies = await prisma.company.findMany({
      where: {
        companyCode: {
          in: ['COM-000001', 'COM-000002'],
        },
      },
      include: {
        branches: true,
        departments: true,
        designations: true,
      },
    });

    const refreshedByCode = new Map(
      refreshedCompanies.map((company) => [company.companyCode, company]),
    );

    const createdCodes: string[] = [];

    for (const employee of employees) {
      const company = refreshedByCode.get(employee.companyCode);
      if (!company) {
        throw new Error(`Company ${employee.companyCode} not found.`);
      }

      const branch = company.branches[0];
      if (!branch) {
        throw new Error(`No branch found for ${employee.companyCode}.`);
      }

      const department = company.departments.find(
        (item) => item.departmentName === employee.departmentName,
      );
      if (!department) {
        throw new Error(
          `Department "${employee.departmentName}" not found for ${employee.companyCode}.`,
        );
      }

      const designation = company.designations.find(
        (item) => item.designationName === employee.designationName,
      );
      if (!designation) {
        throw new Error(
          `Designation "${employee.designationName}" not found for ${employee.companyCode}.`,
        );
      }

      await prisma.employee.upsert({
        where: { employeeCode: employee.employeeCode },
        update: {
          companyId: company.id,
          branchId: branch.id,
          departmentId: department.id,
          designationId: designation.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          mobile: employee.mobile,
          joiningDate: new Date(employee.joiningDate),
          employeeType: employee.employeeType,
          employmentStatus: employee.employmentStatus,
          isActive: true,
        },
        create: {
          employeeCode: employee.employeeCode,
          companyId: company.id,
          branchId: branch.id,
          departmentId: department.id,
          designationId: designation.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          mobile: employee.mobile,
          joiningDate: new Date(employee.joiningDate),
          employeeType: employee.employeeType,
          employmentStatus: employee.employmentStatus,
          isActive: true,
        },
      });

      createdCodes.push(employee.employeeCode);
    }

    const employeeRows = await prisma.employee.findMany({
      where: {
        employeeCode: {
          in: employees.map((item) => item.employeeCode),
        },
      },
      select: {
        id: true,
        employeeCode: true,
      },
    });

    const idByCode = new Map(
      employeeRows.map((row) => [row.employeeCode, row.id]),
    );

    for (const employee of employees) {
      if (!employee.managerCode) {
        continue;
      }

      const employeeId = idByCode.get(employee.employeeCode);
      const managerId = idByCode.get(employee.managerCode);

      if (!employeeId || !managerId) {
        throw new Error(
          `Unable to link manager ${employee.managerCode} for ${employee.employeeCode}.`,
        );
      }

      await prisma.employee.update({
        where: { id: employeeId },
        data: { managerId },
      });
    }

    await ensureNumberSeries(prisma, 'EMPLOYEE', 'GLOBAL', 'EMP', 10);
    await ensureNumberSeries(prisma, 'DESIGNATION', kowdiar.id, 'DES', 5);

    const summary = await prisma.employee.findMany({
      where: {
        employeeCode: {
          in: createdCodes,
        },
      },
      select: {
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        employmentStatus: true,
        company: {
          select: {
            companyCode: true,
            companyName: true,
          },
        },
        department: {
          select: {
            departmentName: true,
          },
        },
        designation: {
          select: {
            designationName: true,
          },
        },
        manager: {
          select: {
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        employeeCode: 'asc',
      },
    });

    console.log(`Seeded ${summary.length} employees across 2 companies.`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
