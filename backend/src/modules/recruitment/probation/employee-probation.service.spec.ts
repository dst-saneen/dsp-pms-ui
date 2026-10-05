import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';
import { EmployeeProbationService } from './employee-probation.service';

describe('EmployeeProbationService override authorization', () => {
  const prisma = {
    employee: {
      findUnique: jest.fn(),
    },
  };
  const scope = {
    assertEmployeeInScope: jest.fn(),
  };
  const lifecycleTransitions = {
    confirmActive: jest.fn(),
  };

  const service = new EmployeeProbationService(
    prisma as never,
    scope as never,
    lifecycleTransitions as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    scope.assertEmployeeInScope.mockResolvedValue(undefined);
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      probationConfirmedAt: null,
    });
  });

  it('rejects early confirmation without the override permission', async () => {
    await expect(
      service.confirmActive('emp-1', 'user-1', {
        override: true,
        overrideReason: 'Join date brought forward by client',
        permissions: ['hr.recruitment.manage'],
      }),
    ).rejects.toMatchObject({
      code: RECRUITMENT_ERROR_CODES.PROBATION_OVERRIDE_FORBIDDEN,
    });
    expect(lifecycleTransitions.confirmActive).not.toHaveBeenCalled();
  });

  it('requires a structured override reason', async () => {
    await expect(
      service.confirmActive('emp-1', 'user-1', {
        override: true,
        overrideReason: 'too short',
        permissions: ['hr.recruitment.probation.override'],
      }),
    ).rejects.toMatchObject({
      code: RECRUITMENT_ERROR_CODES.PROBATION_OVERRIDE_REASON_REQUIRED,
    });
  });

  it('allows authorized early confirmation with a structured reason', async () => {
    lifecycleTransitions.confirmActive.mockResolvedValue({ id: 'emp-1' });

    await service.confirmActive('emp-1', 'user-1', {
      override: true,
      overrideReason: 'Business required an earlier start date',
      permissions: ['hr.recruitment.probation.override'],
    });

    expect(lifecycleTransitions.confirmActive).toHaveBeenCalledWith(
      'emp-1',
      expect.objectContaining({
        probationOverrideReason: 'Business required an earlier start date',
      }),
    );
  });
});
