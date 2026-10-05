import { ConflictException } from '@nestjs/common';

import { HrRequestTypeService } from './hr-request-type.service';

describe('HrRequestTypeService workflow configuration', () => {
  const prisma = {
    hrRequestType: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    approvalWorkflow: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    approvalWorkflowStep: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
  };
  const scope = {
    current: jest.fn().mockReturnValue({ activeCompanyId: 'co-1' }),
    companyWhere: jest.fn().mockReturnValue({ id: 'co-1' }),
  };
  const audit = { log: jest.fn() };
  const actor = {
    id: 'user-1',
    authorization: { isGlobal: false, permissions: ['hr.requests.manage'] },
  };
  const service = new HrRequestTypeService(
    prisma as never,
    scope as never,
    audit as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    scope.current.mockReturnValue({ activeCompanyId: 'co-1' });
    scope.companyWhere.mockReturnValue({ id: 'co-1' });
    prisma.approvalWorkflow.findMany.mockResolvedValue([]);
    prisma.approvalWorkflow.findUnique.mockResolvedValue(null);
    prisma.approvalWorkflow.create.mockResolvedValue({
      id: 'workflow-created',
      workflowCode: 'HR_REQUEST',
      workflowName: 'Manager approves HR request',
    });
    prisma.hrRequestType.findMany.mockResolvedValue([]);
    prisma.hrRequestType.create.mockResolvedValue({
      id: 'type-1',
      requestCode: 'HRT-00001',
    });
  });

  it('requires explicit company workflow configuration instead of creating one', async () => {
    await expect(
      service.create(
        { requestName: 'Employment letter', requiresApproval: true },
        actor as never,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.approvalWorkflow.create).not.toHaveBeenCalled();
    expect(prisma.approvalWorkflow.update).not.toHaveBeenCalled();
    expect(prisma.approvalWorkflowStep.deleteMany).not.toHaveBeenCalled();
    expect(prisma.approvalWorkflowStep.createMany).not.toHaveBeenCalled();
    expect(prisma.hrRequestType.create).not.toHaveBeenCalled();
  });
});
