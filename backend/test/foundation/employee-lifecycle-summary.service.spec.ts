import { EmployeeLifecycleSummaryService } from '../../src/modules/employee-lifecycle-summary/employee-lifecycle-summary.service';

describe('EmployeeLifecycleSummaryService', () => {
  const scope = {
    onboardingWhere: jest.fn().mockReturnValue({ companyId: 'company-a' }),
    onboardingTaskWhere: jest.fn().mockReturnValue({}),
    employeeAssetWhere: jest.fn().mockReturnValue({}),
    assertEmployeeInScope: jest.fn(),
  };

  it('counts only actively assigned assets with null returnedDate', async () => {
    const count = jest.fn().mockResolvedValue(3);
    const prisma = {
      employeeAsset: { count },
    };

    const service = new EmployeeLifecycleSummaryService(
      prisma as never,
      scope as never,
    );

    await expect(service.getAssignedEmployeeAssetCount()).resolves.toBe(3);
    expect(count).toHaveBeenCalledWith({
      where: {
        status: 'ASSIGNED',
        returnedDate: null,
      },
    });
  });
});
