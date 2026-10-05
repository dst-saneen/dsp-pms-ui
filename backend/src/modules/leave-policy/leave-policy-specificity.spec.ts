import { scoreLeavePolicy } from './leave-policy-specificity';

describe('scoreLeavePolicy', () => {
  it('scores company default below every branch tier', () => {
    expect(
      scoreLeavePolicy({
        branchId: null,
        departmentId: null,
        designationId: null,
      }),
    ).toEqual({ tier: 'COMPANY_DEFAULT', specificity: 0 });
  });

  it('scores the four locked branch precedence tiers', () => {
    expect(
      scoreLeavePolicy({
        branchId: 'br-1',
        departmentId: null,
        designationId: null,
      }),
    ).toEqual({ tier: 'BRANCH_DEFAULT', specificity: 1 });
    expect(
      scoreLeavePolicy({
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: null,
      }),
    ).toEqual({ tier: 'BRANCH_DEPARTMENT', specificity: 2 });
    expect(
      scoreLeavePolicy({
        branchId: 'br-1',
        departmentId: null,
        designationId: 'des-1',
      }),
    ).toEqual({ tier: 'BRANCH_DESIGNATION', specificity: 3 });
    expect(
      scoreLeavePolicy({
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: 'des-1',
      }),
    ).toEqual({
      tier: 'BRANCH_DEPARTMENT_DESIGNATION',
      specificity: 4,
    });
  });
});
