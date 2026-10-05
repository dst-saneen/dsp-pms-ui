import { AttendanceExceptionService } from './attendance-exception.service';

describe('AttendanceExceptionService', () => {
  it('resolves exceptions without cancelling attendance regularizations', async () => {
    const tx = {
      attendanceException: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      attendanceRegularization: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      approvalTransaction: {
        update: jest.fn(),
      },
    };
    const service = new AttendanceExceptionService({} as never);

    await service.resolveForAttendance(
      'attendance-1',
      'REGULARIZATION_APPROVED',
      'user-1',
      tx as never,
    );

    expect(tx.attendanceException.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.attendanceRegularization.findMany).not.toHaveBeenCalled();
    expect(tx.attendanceRegularization.update).not.toHaveBeenCalled();
    expect(tx.approvalTransaction.update).not.toHaveBeenCalled();
  });
});
