import {
  ONBOARDING_BRANCH_TIMEZONE_NOT_CONFIGURED,
  OnboardingResponseMapper,
  onboardingBranchTimezoneForView,
} from './onboarding-response.mapper';

describe('onboardingBranchTimezoneForView', () => {
  it('keeps a configured IANA branch timezone', () => {
    expect(onboardingBranchTimezoneForView('Asia/Dubai')).toBe('Asia/Dubai');
  });

  it('reports an explicit not-configured state instead of silently exposing UTC', () => {
    expect(onboardingBranchTimezoneForView(null)).toBe(
      ONBOARDING_BRANCH_TIMEZONE_NOT_CONFIGURED,
    );
    expect(onboardingBranchTimezoneForView('not/a-timezone')).toBe(
      ONBOARDING_BRANCH_TIMEZONE_NOT_CONFIGURED,
    );
  });
});

describe('legacy onboarding response mapping', () => {
  it('projects legacy task rows instead of returning an empty task collection', () => {
    const mapper = new OnboardingResponseMapper({} as never, {} as never);
    const result = (mapper as unknown as {
      mapImportedOnboarding: (record: unknown) => {
        tasks: Array<{ legacyStatus: string; taskName: string }>;
      };
    }).mapImportedOnboarding({
      id: 'legacy-onboarding',
      version: 1,
      status: 'IN_PROGRESS',
      employee: {
        id: 'employee-1',
        employeeCode: 'EMP-001',
        firstName: 'Legacy',
        lastName: 'Employee',
      },
      templateId: 'template-1',
      template: { templateCode: 'LEGACY', templateName: 'Legacy template' },
      templateVersionId: 'version-1',
      templateVersion: { versionNo: 1 },
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      completedAt: null,
      completedDate: null,
      cancelledAt: null,
      totalTasks: 1,
      completedTasks: 0,
      progress: 0,
      tasks: [
        {
          id: 'legacy-task',
          version: 1,
          taskName: 'Provide identity document',
          description: null,
          status: 'PENDING',
          ownerType: 'EMPLOYEE',
          workType: 'CHECKLIST',
          assignedDepartment: null,
          executorDepartment: null,
          assignedToUser: null,
          dueDate: null,
          resolvedAt: null,
          completedDate: null,
        },
      ],
    });

    expect(result.tasks).toEqual([
      expect.objectContaining({
        taskName: 'Provide identity document',
        legacyStatus: 'PENDING',
      }),
    ]);
  });
});
