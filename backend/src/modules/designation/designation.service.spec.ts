import { DesignationService } from './designation.service';

describe('DesignationService onboarding workspace', () => {
  it('limits the onboarding workspace to the requested Company within the actor scope', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const actorScope = {
      designationWhere: jest.fn().mockReturnValue({
        company: { companyGroupId: 'group-1' },
      }),
    };
    const service = new DesignationService(
      { designation: { findMany } } as never,
      {} as never,
      {} as never,
      actorScope as never,
      {} as never,
      {} as never,
    );

    await service.getOnboardingWorkspace('company-india');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { company: { companyGroupId: 'group-1' } },
            { companyId: 'company-india' },
            {
              OR: [
                { isActive: true },
                {
                  isActive: false,
                  onboardingTemplateId: { not: null },
                },
              ],
            },
          ],
        },
      }),
    );
  });
});
