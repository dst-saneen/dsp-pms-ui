import { GoneException } from '@nestjs/common';

import { DomainConflictException } from '../../src/common';
import { ApprovalService } from '../../src/modules/approval/approval.service';
import { PROJECTS_ERROR_CODES } from '../../src/modules/projects/constants/projects-error-codes';
import { rejectRetiredProjectsMutation } from '../../src/modules/projects/retired/reject-retired-route';
import { detectParentCycle } from '../../src/modules/projects/policies/task-parent-cycle';
import {
  exceedsDailyHoursCap,
  isValidLineHours,
  isXorTaskOrCategory,
} from '../../src/modules/projects/policies/timesheet-hours';
import { ProjectSummaryService } from '../../src/modules/projects/services/project-summary.service';
import { TaskSubmissionsController } from '../../src/modules/task-submissions/task-submissions.controller';
import { TaskReviewsController } from '../../src/modules/task-reviews/task-reviews.controller';
import { TaskWorkSessionController } from '../../src/modules/task-work-session/task-work-session.controller';

describe('Project Lite Phase 8 legacy mutation denial', () => {
  it('rejects scaffolding mutations with PROJECTS_LEGACY_ROUTE_DISABLED', () => {
    expect(() => rejectRetiredProjectsMutation()).toThrow(GoneException);
    try {
      rejectRetiredProjectsMutation();
    } catch (error) {
      expect(error).toBeInstanceOf(GoneException);
      expect((error as GoneException).getResponse()).toEqual(
        expect.objectContaining({
          code: PROJECTS_ERROR_CODES.PROJECTS_LEGACY_ROUTE_DISABLED,
        }),
      );
    }
  });

  it('disables task-submissions / task-reviews / task-work-session writes', () => {
    const submissions = new TaskSubmissionsController();
    const reviews = new TaskReviewsController();
    const sessions = new TaskWorkSessionController();

    expect(() => submissions.create()).toThrow(GoneException);
    expect(() => submissions.update()).toThrow(GoneException);
    expect(() => submissions.remove()).toThrow(GoneException);
    expect(() => reviews.create()).toThrow(GoneException);
    expect(() => reviews.update()).toThrow(GoneException);
    expect(() => reviews.remove()).toThrow(GoneException);
    expect(() => sessions.startSession()).toThrow(GoneException);
    expect(() => sessions.endSession()).toThrow(GoneException);
  });

  it('denies generic Approval for WORK_LOG_HEADER', async () => {
    const prisma = {
      approvalTransactionStep: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'step-1',
          status: 'PENDING',
          transaction: { entityType: 'WORK_LOG_HEADER' },
        }),
      },
    };
    const service = new ApprovalService(prisma as never);

    await expect(service.approve('step-1')).rejects.toBeInstanceOf(
      DomainConflictException,
    );
    try {
      await service.approve('step-1');
    } catch (error) {
      expect((error as DomainConflictException).getResponse()).toEqual(
        expect.objectContaining({
          code: PROJECTS_ERROR_CODES.TIMESHEET_LEGACY_APPROVAL_DISABLED,
        }),
      );
    }
  });
});

describe('Project Lite Phase 8 parent cycle policy', () => {
  it('blocks self-parent and ancestor cycles', () => {
    const parentById = new Map<string, string | null>([
      ['a', null],
      ['b', 'a'],
      ['c', 'b'],
    ]);

    expect(
      detectParentCycle({
        selfTaskId: 'a',
        proposedParentId: 'a',
        parentById,
      }),
    ).toBe('SELF');

    expect(
      detectParentCycle({
        selfTaskId: 'a',
        proposedParentId: 'c',
        parentById,
      }),
    ).toBe('CYCLE');

    expect(
      detectParentCycle({
        selfTaskId: 'c',
        proposedParentId: 'a',
        parentById,
      }),
    ).toBeNull();
  });
});

describe('Project Lite Phase 8 timesheet hour rules', () => {
  it('enforces line range, daily cap, and XOR targets', () => {
    expect(isValidLineHours(8)).toBe(true);
    expect(isValidLineHours(0)).toBe(false);
    expect(isValidLineHours(24)).toBe(true);
    expect(isValidLineHours(24.01)).toBe(false);

    expect(exceedsDailyHoursCap(16, 8)).toBe(false);
    expect(exceedsDailyHoursCap(16, 9)).toBe(true);

    expect(isXorTaskOrCategory('task-1', null)).toBe(true);
    expect(isXorTaskOrCategory(null, 'cat-1')).toBe(true);
    expect(isXorTaskOrCategory('task-1', 'cat-1')).toBe(false);
    expect(isXorTaskOrCategory(null, null)).toBe(false);
  });
});

describe('Project Lite Phase 8 finance summary redaction', () => {
  it('returns enabled:false stub without profit/margin fields', async () => {
    const project = {
      id: 'proj-1',
      companyId: 'co-1',
      currencyCode: 'INR',
      expectedIncome: null,
      expenseBudget: null,
    };
    const scope = {
      requireProject: jest.fn().mockResolvedValue(project),
    };
    const gate = {
      assertEnabledForContext: jest.fn(),
    };
    const query = {};
    const financeFeature = {
      isEnabledForCompany: jest.fn().mockReturnValue(false),
    };
    const financeReports = {
      projectFinanceSummary: jest.fn(),
    };
    const service = new ProjectSummaryService(
      {} as never,
      scope as never,
      gate as never,
      query as never,
      financeFeature as never,
      financeReports as never,
    );

    const summary = await service.getFinanceSummary('proj-1', {
      userId: 'u1',
      employeeId: undefined,
      permissions: [],
    });

    expect(summary.enabled).toBe(false);
    expect(financeReports.projectFinanceSummary).not.toHaveBeenCalled();
    expect(summary).not.toHaveProperty('profit');
    expect(summary).not.toHaveProperty('margin');
    expect(summary).not.toHaveProperty('profitability');
    expect(String(summary.message).toLowerCase()).not.toContain('profit');
    expect(String(summary.message).toLowerCase()).not.toContain('margin');
  });
});
