import { EmployeeService } from './employee.service';

describe('EmployeeService organization rules', () => {
  const employeeFindFirst = jest.fn();

  const service = new EmployeeService(
    {
      employee: { findFirst: employeeFindFirst },
    } as never,
    {} as never,
    {} as never,
    {
      employeeWhere: jest.fn().mockReturnValue({}),
    } as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const validateManager = (managerId: string, companyId: string) =>
    (
      service as unknown as {
        validateManager: (
          managerId: string,
          companyId: string,
        ) => Promise<unknown>;
      }
    ).validateManager(managerId, companyId);

  beforeEach(() => {
    employeeFindFirst.mockReset();
  });

  it('allows a reporting manager in another branch of the same company', async () => {
    employeeFindFirst.mockResolvedValue({
      id: 'manager-kochi',
      companyId: 'company-india',
      branchId: 'branch-kochi',
      isActive: true,
    });

    await expect(
      validateManager('manager-kochi', 'company-india'),
    ).resolves.toMatchObject({ id: 'manager-kochi' });

    expect(employeeFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'manager-kochi',
        companyId: 'company-india',
      },
    });
  });

  it('keeps manager lookup company-scoped', async () => {
    employeeFindFirst.mockResolvedValue(null);

    await expect(
      validateManager('manager-uae', 'company-india'),
    ).rejects.toThrow('Manager not found');

    expect(employeeFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'manager-uae',
        companyId: 'company-india',
      },
    });
  });
});
