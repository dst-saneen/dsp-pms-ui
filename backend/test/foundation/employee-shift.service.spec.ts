import { NotFoundException } from '@nestjs/common';

import { EmployeeShiftService } from '../../src/modules/employee-shift/employee-shift.service';

function createService(prisma: Record<string, unknown>) {
  const employeeDomainScope = {
    employeeWhere: jest.fn().mockReturnValue({ companyId: 'company-a' }),
    assertEmployeeInScope: jest.fn(),
    notFound: jest.fn((entity: string): never => {
      throw new NotFoundException(`${entity} not found`);
    }),
  };

  return {
    service: new EmployeeShiftService(
      prisma as never,
      employeeDomainScope as never,
    ),
    employeeDomainScope,
  };
}

describe('EmployeeShiftService tenant isolation', () => {
  it('404s when the employee is outside the active scope', async () => {
    const { service, employeeDomainScope } = createService({});
    employeeDomainScope.assertEmployeeInScope.mockRejectedValue(
      new NotFoundException('Employee not found'),
    );

    await expect(
      service.create({
        employeeId: 'emp-other',
        shiftId: 'shift-a',
        effectiveFrom: '2026-08-01',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s when the shift belongs to another company', async () => {
    const { service, employeeDomainScope } = createService({
      shift: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });
    employeeDomainScope.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-a',
      companyId: 'company-a',
    });

    await expect(
      service.create({
        employeeId: 'emp-a',
        shiftId: 'shift-b',
        effectiveFrom: '2026-08-01',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(employeeDomainScope.notFound).toHaveBeenCalledWith('Shift');
  });

  it('lists only assignments whose employee is in tenant scope', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service, employeeDomainScope } = createService({
      employeeShift: { findMany },
    });
    employeeDomainScope.employeeWhere.mockReturnValue({
      company: { companyGroupId: 'group-a' },
    });

    await service.findAll();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employee: { company: { companyGroupId: 'group-a' } },
        },
      }),
    );
  });

  it('returns an empty list when there is no organization context', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { service, employeeDomainScope } = createService({
      employeeShift: { findMany },
    });
    employeeDomainScope.employeeWhere.mockReturnValue({ id: '__no_scope__' });

    await service.findAll();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          employee: { id: '__no_scope__' },
        },
      }),
    );
  });

  it('404s on detail when the assignment employee is out of scope', async () => {
    const { service } = createService({
      employeeShift: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });

    await expect(service.findOne('assignment-foreign')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
