import { Prisma } from '@prisma/client';

import { PayrollResponseMapper } from './payroll-response.mapper';

describe('PayrollResponseMapper', () => {
  it('keeps the complete employee payslip summary contract', () => {
    const mapper = new PayrollResponseMapper(
      {
        decimalToString: (value: Prisma.Decimal | null | undefined) =>
          value?.toString() ?? '0',
      } as never,
      {} as never,
    );
    const generatedAt = new Date('2026-09-22T08:30:00.000Z');

    expect(
      mapper.toPayslipSummary({
        id: 'payslip-1',
        payrollRunId: 'run-1',
        payrollYear: 2026,
        payrollMonth: 9,
        employeeCode: 'EMP-001',
        displayName: 'QA Employee',
        status: 'AVAILABLE',
        generatedAt,
        payrollRun: {
          runNumber: 'RUN-2026-09',
          currencyCode: 'AED',
        },
        payrollRunEmployee: {
          netSalary: new Prisma.Decimal('1234.56'),
        },
      }),
    ).toEqual({
      id: 'payslip-1',
      payrollRunId: 'run-1',
      year: 2026,
      month: 9,
      payrollYear: 2026,
      payrollMonth: 9,
      runNumber: 'RUN-2026-09',
      employeeCode: 'EMP-001',
      displayName: 'QA Employee',
      status: 'AVAILABLE',
      netSalary: '1234.56',
      currencyCode: 'AED',
      generatedAt: generatedAt.toISOString(),
      availableAt: generatedAt.toISOString(),
    });
  });
});
