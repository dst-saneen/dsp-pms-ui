import { ConflictException } from '@nestjs/common';

import { DesignationService } from '../../src/modules/designation/designation.service';

describe('DesignationService onboarding department sync ownership', () => {
  const designation = {
    id: 'designation-a',
    companyId: 'company-1',
    designationCode: 'DES-A',
    designationName: 'Designation A',
    isActive: true,
    onboardingTemplateId: 'template-shared',
  };

  function buildService(options: {
    sharedLegacyDesignation?: { id: string } | null;
    sharedAssignment?: { id: string } | null;
    sharedScope?: { id: string } | null;
  }) {
    const siblingChecklist = {
      id: 'department-template-b',
      departmentId: 'department-b',
    };
    const tx = {
      designation: {
        findFirst: jest.fn().mockImplementation(
          ({
            where,
          }: {
            where: {
              id?: string | { not: string };
              onboardingTemplateId?: string;
            };
          }) => {
            if (where.id === designation.id) {
              return Promise.resolve(designation);
            }
            if (
              where.onboardingTemplateId === designation.onboardingTemplateId
            ) {
              return Promise.resolve(options.sharedLegacyDesignation ?? null);
            }
            return Promise.resolve(null);
          },
        ),
        update: jest.fn().mockResolvedValue(designation),
        findUniqueOrThrow: jest.fn().mockResolvedValue(designation),
      },
      onboardingTemplateVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'version-shared',
          status: 'DRAFT',
          departments: [siblingChecklist],
        }),
      },
      designationOnboardingAssignment: {
        findFirst: jest
          .fn()
          .mockResolvedValue(options.sharedAssignment ?? null),
      },
      onboardingTemplateScope: {
        findFirst: jest.fn().mockResolvedValue(options.sharedScope ?? null),
      },
      onboardingTaskGroup: {
        findMany: jest.fn().mockResolvedValue([{ id: 'task-group-b' }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      onboardingTemplateTask: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      onboardingDepartmentTemplate: {
        delete: jest.fn().mockResolvedValue(siblingChecklist),
      },
    };
    const prisma = {
      designation: {
        findFirst: jest.fn().mockResolvedValue(designation),
      },
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new DesignationService(
      prisma as never,
      audit as never,
      {} as never,
      {
        designationWhere: jest.fn().mockReturnValue({ companyId: 'company-1' }),
      } as never,
      {} as never,
      {} as never,
    );

    return { audit, service, tx };
  }

  function expectSiblingChecklistUntouched(tx: {
    onboardingTaskGroup: { findMany: jest.Mock; deleteMany: jest.Mock };
    onboardingTemplateTask: { deleteMany: jest.Mock };
    onboardingDepartmentTemplate: { delete: jest.Mock };
  }) {
    expect(tx.onboardingTaskGroup.findMany).not.toHaveBeenCalled();
    expect(tx.onboardingTaskGroup.deleteMany).not.toHaveBeenCalled();
    expect(tx.onboardingTemplateTask.deleteMany).not.toHaveBeenCalled();
    expect(tx.onboardingDepartmentTemplate.delete).not.toHaveBeenCalled();
  }

  it('fails closed before deleting a sibling legacy designation checklist', async () => {
    const { audit, service, tx } = buildService({
      sharedLegacyDesignation: { id: 'designation-b' },
    });

    await expect(
      service.update('designation-a', { onboardingDepartmentIds: [] }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.designation.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company-1',
        onboardingTemplateId: 'template-shared',
        id: { not: 'designation-a' },
      },
      select: { id: true },
    });
    expectSiblingChecklistUntouched(tx);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('fails closed before deleting a checklist owned through another designation assignment', async () => {
    const { audit, service, tx } = buildService({
      sharedAssignment: { id: 'assignment-b' },
    });

    await expect(
      service.update('designation-a', { onboardingDepartmentIds: [] }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.designationOnboardingAssignment.findFirst).toHaveBeenCalledWith({
      where: {
        onboardingTemplateId: 'template-shared',
        designationId: { not: 'designation-a' },
      },
      select: { id: true },
    });
    expectSiblingChecklistUntouched(tx);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('fails closed before deleting a checklist exposed through a shared template scope', async () => {
    const { audit, service, tx } = buildService({
      sharedScope: { id: 'scope-shared' },
    });

    await expect(
      service.update('designation-a', { onboardingDepartmentIds: [] }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(tx.onboardingTemplateScope.findFirst).toHaveBeenCalledWith({
      where: {
        onboardingTemplateVersionId: 'version-shared',
        OR: [
          { designationId: null },
          { designationId: { not: 'designation-a' } },
        ],
      },
      select: { id: true },
    });
    expectSiblingChecklistUntouched(tx);
    expect(audit.log).not.toHaveBeenCalled();
  });
});
