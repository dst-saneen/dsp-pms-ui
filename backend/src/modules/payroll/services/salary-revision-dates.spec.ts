import * as employeeInputs from './payroll-employee-inputs.service';

describe('salary revision end-date validation', () => {
  it('rejects an end date before the revision start date', () => {
    const validate = (
      employeeInputs as unknown as {
        assertSalaryRevisionEndDate: (from: Date, to: Date) => void;
      }
    ).assertSalaryRevisionEndDate;

    expect(typeof validate).toBe('function');
    expect(() =>
      validate(
        new Date('2026-09-10T00:00:00.000Z'),
        new Date('2026-09-09T00:00:00.000Z'),
      ),
    ).toThrow('effectiveTo cannot be before effectiveFrom');
  });
});
