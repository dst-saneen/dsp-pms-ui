import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '../..');

describe('Employee manual creation source default', () => {
  const schema = readFileSync(
    resolve(repositoryRoot, 'prisma/schema.prisma'),
    'utf8',
  );
  const createEmployeeDto = readFileSync(
    resolve(repositoryRoot, 'src/modules/employee/dto/create-employee.dto.ts'),
    'utf8',
  );
  const employeeService = readFileSync(
    resolve(repositoryRoot, 'src/modules/employee/employee.service.ts'),
    'utf8',
  );

  it('uses MANUAL as the database default without rewriting imported records', () => {
    const migration = readFileSync(
      resolve(
        repositoryRoot,
        'prisma/migrations/20260923100000_employee_creation_source_manual_default/migration.sql',
      ),
      'utf8',
    );

    expect(schema).toMatch(
      /creationSource EmployeeCreationSource @default\(MANUAL\)/,
    );
    expect(migration).toContain(
      'ALTER TABLE "employees" ALTER COLUMN "creationSource" SET DEFAULT \'MANUAL\';',
    );
    expect(migration).not.toMatch(/\bUPDATE\b/i);
    expect(migration).not.toMatch(/\bINSERT\b/i);
    expect(migration).not.toContain('dsp_pms');
  });

  it('records a neutral creation reason for manual employee creation', () => {
    expect(createEmployeeDto).toContain('creationReason?: string;');
    expect(createEmployeeDto).not.toContain('legacyImportReason');
    expect(employeeService).toContain(
      'const { creationReason, externalReference, ...employeeData } = dto;',
    );
    expect(employeeService).toContain('creationReason,');
    expect(employeeService).not.toContain('legacyImportReason');
  });
});
