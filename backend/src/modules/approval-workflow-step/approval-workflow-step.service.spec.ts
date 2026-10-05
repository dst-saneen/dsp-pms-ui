import { NotFoundException } from '@nestjs/common';

import { ApprovalWorkflowStepService } from './approval-workflow-step.service';

describe('ApprovalWorkflowStepService company scope', () => {
  const prisma = {
    approvalWorkflow: { findFirst: jest.fn() },
    approvalWorkflowStep: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const audit = { log: jest.fn() };
  const scope = {
    companyWhere: jest.fn().mockReturnValue({ id: 'company-a' }),
  };

  function service() {
    return new ApprovalWorkflowStepService(
      prisma as never,
      audit as never,
      scope as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    scope.companyWhere.mockReturnValue({ id: 'company-a' });
  });

  it('refuses to create a step for a workflow outside the active company scope', async () => {
    prisma.approvalWorkflow.findFirst.mockResolvedValue(null);

    await expect(
      service().create({
        workflowId: 'workflow-other',
        stepNo: 1,
        approverType: 'HR',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.approvalWorkflow.findFirst).toHaveBeenCalledWith({
      where: { id: 'workflow-other', company: { id: 'company-a' } },
      select: { id: true },
    });
    expect(prisma.approvalWorkflowStep.create).not.toHaveBeenCalled();
  });

  it('does not reveal a step direct ID outside the active company scope', async () => {
    prisma.approvalWorkflowStep.findFirst.mockResolvedValue(null);

    await expect(service().findOne('step-other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.approvalWorkflowStep.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'step-other',
          workflow: { company: { id: 'company-a' } },
        },
      }),
    );
  });
});
