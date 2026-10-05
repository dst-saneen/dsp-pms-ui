import { AuditService } from '../../src/modules/audit/audit.service';

describe('AuditService transactional writes', () => {
  it('uses the provided transaction client when tx is set', async () => {
    const prisma = {
      auditLog: {
        create: jest.fn(),
      },
    };
    const tx = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const service = new AuditService(prisma as never);
    await service.log(
      'LeaveRequest',
      'lr-1',
      'SUBMIT',
      null,
      { status: 'SUBMITTED' },
      {
        tx: tx as never,
      },
    );

    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('falls back to the shared Prisma service without tx', async () => {
    const prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-2' }),
      },
    };

    const service = new AuditService(prisma as never);
    await service.log('Attendance', 'att-1', 'CHECK_IN', null, {
      status: 'PRESENT',
    });

    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
