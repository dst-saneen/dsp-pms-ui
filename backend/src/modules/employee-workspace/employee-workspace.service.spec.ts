import { BadRequestException } from '@nestjs/common';

import { BranchTimeService } from '../attendance/branch-time.service';

import { EmployeeWorkspaceService } from './employee-workspace.service';

describe('EmployeeWorkspaceService', () => {
  const prisma = {
    employee: { findUnique: jest.fn() },
    shiftRosterEntry: { findFirst: jest.fn() },
  };

  const service = new EmployeeWorkspaceService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    new BranchTimeService(),
    {} as never,
    {} as never,
    {} as never,
    prisma as never,
  );

  it("does not look up today's roster using UTC when a legacy branch lacks a timezone", async () => {
    prisma.employee.findUnique.mockResolvedValue({
      branch: { timezone: null },
    });

    const buildTodayShift = service as unknown as {
      buildTodayShift(employeeId: string): Promise<unknown>;
    };

    try {
      await buildTodayShift.buildTodayShift('employee-1');
      throw new Error('Expected a missing branch-timezone error');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse();
      expect(typeof response).not.toBe('string');
      if (typeof response !== 'string') {
        expect(response).toHaveProperty('code', 'BRANCH_TIMEZONE_REQUIRED');
      }
    }
    expect(prisma.shiftRosterEntry.findFirst).not.toHaveBeenCalled();
  });
});
