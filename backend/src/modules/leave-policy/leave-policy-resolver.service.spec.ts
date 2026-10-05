import { BadRequestException, NotFoundException } from '@nestjs/common';

import { WorkforceErrorCode } from '../../common/constants';
import { LeavePolicyResolverService } from './leave-policy-resolver.service';

describe('LeavePolicyResolverService', () => {
  const prisma = {
    employee: {
      findUnique: jest.fn(),
    },
    leaveType: {
      findUnique: jest.fn(),
    },
    leavePolicy: {
      findMany: jest.fn(),
    },
    holiday: {
      findMany: jest.fn(),
    },
    branchWorkingDay: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const calendarConsumer = {
    isActiveOffice: jest.fn().mockResolvedValue(false),
    resolveConsumerDays: jest.fn(),
    summarizeLeaveDays: jest.fn(),
  };

  const service = new LeavePolicyResolverService(
    prisma as never,
    calendarConsumer as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    calendarConsumer.isActiveOffice.mockResolvedValue(false);
  });

  describe('resolvePolicy', () => {
    it('prefers branch+department+designation over broader policies', async () => {
      prisma.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'company',
          branchId: null,
          departmentId: null,
          designationId: null,
        },
        {
          id: 'default',
          branchId: 'br-1',
          departmentId: null,
          designationId: null,
        },
        {
          id: 'dept',
          branchId: 'br-1',
          departmentId: 'dept-1',
          designationId: null,
        },
        {
          id: 'exact',
          branchId: 'br-1',
          departmentId: 'dept-1',
          designationId: 'desig-1',
        },
      ]);

      const policy = await service.resolvePolicy({
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: 'desig-1',
        leaveTypeId: 'lt-1',
      });

      expect(policy.id).toBe('exact');
      expect(policy.tier).toBe('BRANCH_DEPARTMENT_DESIGNATION');
      expect(policy.specificity).toBe(4);
    });

    it('prefers branch default over company default', async () => {
      prisma.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'company',
          branchId: null,
          departmentId: null,
          designationId: null,
        },
        {
          id: 'branch',
          branchId: 'br-1',
          departmentId: null,
          designationId: null,
        },
      ]);

      const policy = await service.resolvePolicy({
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: null,
        designationId: null,
        leaveTypeId: 'lt-1',
      });

      expect(policy.id).toBe('branch');
      expect(policy.tier).toBe('BRANCH_DEFAULT');
      expect(policy.specificity).toBe(1);
    });

    it('uses company default when no branch policy matches', async () => {
      prisma.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'company',
          branchId: null,
          departmentId: null,
          designationId: null,
        },
        {
          id: 'other-branch',
          branchId: 'br-2',
          departmentId: null,
          designationId: null,
        },
      ]);

      const policy = await service.resolvePolicy({
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: null,
        designationId: null,
        leaveTypeId: 'lt-1',
      });

      expect(policy.id).toBe('company');
      expect(policy.tier).toBe('COMPANY_DEFAULT');
      expect(policy.specificity).toBe(0);
    });

    it('prefers branch+department over branch default', async () => {
      prisma.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'default',
          branchId: 'br-1',
          departmentId: null,
          designationId: null,
        },
        {
          id: 'dept',
          branchId: 'br-1',
          departmentId: 'dept-1',
          designationId: null,
        },
      ]);

      const policy = await service.resolvePolicy({
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: 'desig-1',
        leaveTypeId: 'lt-1',
      });

      expect(policy.id).toBe('dept');
      expect(policy.tier).toBe('BRANCH_DEPARTMENT');
      expect(policy.specificity).toBe(2);
    });

    it('prefers branch+designation over branch+department', async () => {
      prisma.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'default',
          branchId: 'br-1',
          departmentId: null,
          designationId: null,
        },
        {
          id: 'dept',
          branchId: 'br-1',
          departmentId: 'dept-1',
          designationId: null,
        },
        {
          id: 'desig',
          branchId: 'br-1',
          departmentId: null,
          designationId: 'desig-1',
        },
      ]);

      const policy = await service.resolvePolicy({
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: 'desig-1',
        leaveTypeId: 'lt-1',
      });

      expect(policy.id).toBe('desig');
      expect(policy.tier).toBe('BRANCH_DESIGNATION');
      expect(policy.specificity).toBe(3);
    });

    it('throws when multiple policies share the same specificity', async () => {
      prisma.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'a',
          branchId: 'br-1',
          departmentId: 'dept-1',
          designationId: null,
        },
        {
          id: 'b',
          branchId: 'br-1',
          departmentId: 'dept-1',
          designationId: null,
        },
      ]);

      await expect(
        service.resolvePolicy({
          companyId: 'co-1',
          branchId: 'br-1',
          departmentId: 'dept-1',
          designationId: null,
          leaveTypeId: 'lt-1',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: WorkforceErrorCode.LEAVE_POLICY_CONFIGURATION_CONFLICT,
        }) as unknown,
      });
    });

    it('throws when multiple company defaults match', async () => {
      prisma.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'a',
          branchId: null,
          departmentId: null,
          designationId: null,
        },
        {
          id: 'b',
          branchId: null,
          departmentId: null,
          designationId: null,
        },
      ]);

      await expect(
        service.resolvePolicy({
          companyId: 'co-1',
          branchId: 'br-1',
          departmentId: null,
          designationId: null,
          leaveTypeId: 'lt-1',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: WorkforceErrorCode.LEAVE_POLICY_CONFIGURATION_CONFLICT,
        }) as unknown,
      });
    });

    it('throws LEAVE_POLICY_NOT_FOUND when no policy matches', async () => {
      prisma.leavePolicy.findMany.mockResolvedValue([]);

      await expect(
        service.resolvePolicy({
          companyId: 'co-1',
          branchId: 'br-1',
          departmentId: 'dept-1',
          designationId: null,
          leaveTypeId: 'lt-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resolveCalculation', () => {
    it('excludes weekends and holidays from requested days', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        isActive: true,
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: null,
        branch: { timezone: 'Asia/Kolkata' },
      });
      prisma.leaveType.findUnique.mockResolvedValue({
        id: 'lt-1',
        isActive: true,
        allowHalfDay: true,
      });
      prisma.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'policy-1',
          branchId: 'br-1',
          departmentId: null,
          designationId: null,
          maxConsecutiveDays: null,
          allowNegativeBalance: false,
          maximumNegativeBalance: null,
          annualEntitlement: 12,
        },
      ]);
      // Monday 2026-08-03 through Friday 2026-08-07, with Wed holiday
      prisma.holiday.findMany.mockResolvedValue([
        { holidayDate: new Date('2026-08-05T00:00:00.000Z') },
      ]);

      const result = await service.resolveCalculation({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        fromDate: '2026-08-03',
        toDate: '2026-08-09', // includes weekend
      });

      expect(result.requestedWorkingDays).toBe(4);
      expect(result.excludedHolidays).toEqual(['2026-08-05']);
      expect(result.excludedNonWorkingDays).toEqual([
        '2026-08-08',
        '2026-08-09',
      ]);
      expect(result.policyId).toBe('policy-1');
      expect(result.calendarRuntimeMode).toBe('LEGACY_OR_SHADOW');
    });

    it('uses runtime consumer when office mode is ACTIVE', async () => {
      calendarConsumer.isActiveOffice.mockResolvedValue(true);
      calendarConsumer.resolveConsumerDays.mockResolvedValue(
        new Map([
          [
            '2026-08-03',
            {
              kind: 'WORKING',
              dayPortion: 'FULL_DAY',
              runtimeDayId: 'rd-1',
            },
          ],
          [
            '2026-08-04',
            {
              kind: 'HOLIDAY',
              dayPortion: 'FULL_DAY',
              runtimeDayId: 'rd-2',
            },
          ],
        ]),
      );
      calendarConsumer.summarizeLeaveDays.mockReturnValue({
        requestedWorkingDays: 1,
        excludedHolidays: ['2026-08-04'],
        excludedNonWorkingDays: [],
        snapshots: [
          {
            businessDate: '2026-08-03',
            runtimeDayId: 'rd-1',
            dayPortion: 'FULL_DAY',
            chargedDays: 1,
            calculationStatus: 'CHARGED',
          },
          {
            businessDate: '2026-08-04',
            runtimeDayId: 'rd-2',
            dayPortion: 'FULL_DAY',
            chargedDays: 0,
            calculationStatus: 'EXCLUDED_HOLIDAY',
          },
        ],
      });

      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        isActive: true,
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: null,
        branch: { timezone: 'Asia/Kolkata' },
      });
      prisma.leaveType.findUnique.mockResolvedValue({
        id: 'lt-1',
        isActive: true,
        allowHalfDay: true,
      });
      prisma.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'policy-1',
          branchId: 'br-1',
          departmentId: null,
          designationId: null,
          maxConsecutiveDays: null,
          allowNegativeBalance: false,
          maximumNegativeBalance: null,
          annualEntitlement: 12,
        },
      ]);

      const result = await service.resolveCalculation({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        fromDate: '2026-08-03',
        toDate: '2026-08-04',
      });

      expect(result.requestedWorkingDays).toBe(1);
      expect(result.calendarRuntimeMode).toBe('ACTIVE');
      expect(result.runtimeDaySnapshots).toHaveLength(2);
      expect(prisma.holiday.findMany).not.toHaveBeenCalled();
      expect(calendarConsumer.resolveConsumerDays).toHaveBeenCalledTimes(1);
      expect(calendarConsumer.resolveConsumerDays).toHaveBeenCalledWith({
        companyId: 'co-1',
        branchId: 'br-1',
        from: '2026-08-03',
        to: '2026-08-04',
      });
    });

    it('charges 0.5 days for a half-day on a single working day', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        isActive: true,
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: null,
        branch: { timezone: 'Asia/Kolkata' },
      });
      prisma.leaveType.findUnique.mockResolvedValue({
        id: 'lt-1',
        isActive: true,
        allowHalfDay: true,
      });
      prisma.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'policy-1',
          branchId: 'br-1',
          departmentId: null,
          designationId: null,
          maxConsecutiveDays: null,
          allowNegativeBalance: false,
          maximumNegativeBalance: null,
          annualEntitlement: 12,
        },
      ]);
      prisma.holiday.findMany.mockResolvedValue([]);

      const result = await service.resolveCalculation({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        fromDate: '2026-08-03',
        toDate: '2026-08-03',
        isHalfDay: true,
      });

      expect(result.requestedWorkingDays).toBe(0.5);
      expect(result.calendarRuntimeMode).toBe('LEGACY_OR_SHADOW');
      const holidayCalls = prisma.holiday.findMany.mock
        .calls as unknown as Array<
        [
          {
            where: {
              companyId: string;
              OR: Array<{ branchId: string | null }>;
            };
          },
        ]
      >;
      expect(holidayCalls[0][0].where.companyId).toBe('co-1');
      expect(holidayCalls[0][0].where.OR).toEqual([
        { branchId: null },
        { branchId: 'br-1' },
      ]);
    });

    it('rejects half-day when leave type disallows it', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        isActive: true,
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: null,
        branch: { timezone: 'Asia/Kolkata' },
      });
      prisma.leaveType.findUnique.mockResolvedValue({
        id: 'lt-1',
        isActive: true,
        allowHalfDay: false,
      });

      await expect(
        service.resolveCalculation({
          employeeId: 'emp-1',
          leaveTypeId: 'lt-1',
          fromDate: '2026-08-03',
          toDate: '2026-08-03',
          isHalfDay: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects half-day spanning multiple calendar days', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        isActive: true,
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: null,
        branch: { timezone: 'Asia/Kolkata' },
      });
      prisma.leaveType.findUnique.mockResolvedValue({
        id: 'lt-1',
        isActive: true,
        allowHalfDay: true,
      });

      await expect(
        service.resolveCalculation({
          employeeId: 'emp-1',
          leaveTypeId: 'lt-1',
          fromDate: '2026-08-03',
          toDate: '2026-08-04',
          isHalfDay: true,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('uses Monday–Friday default when BranchWorkingDay is not available', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        isActive: true,
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: null,
        branch: { timezone: 'Asia/Kolkata' },
      });
      prisma.leaveType.findUnique.mockResolvedValue({
        id: 'lt-1',
        isActive: true,
        allowHalfDay: false,
      });
      prisma.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'policy-1',
          branchId: 'br-1',
          departmentId: null,
          designationId: null,
          maxConsecutiveDays: null,
          allowNegativeBalance: false,
          maximumNegativeBalance: null,
          annualEntitlement: 12,
        },
      ]);
      prisma.holiday.findMany.mockResolvedValue([]);

      const result = await service.resolveCalculation({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        fromDate: '2026-08-07', // Friday
        toDate: '2026-08-10', // Monday
      });

      expect(result.requestedWorkingDays).toBe(2);
      expect(result.excludedNonWorkingDays).toEqual([
        '2026-08-08',
        '2026-08-09',
      ]);
    });

    it('uses the transaction client for policy and legacy calendar reads', async () => {
      const tx = {
        employee: { findUnique: jest.fn() },
        leaveType: { findUnique: jest.fn() },
        leavePolicy: { findMany: jest.fn() },
        branchWorkingDay: { findMany: jest.fn() },
        holiday: { findMany: jest.fn() },
      };
      tx.employee.findUnique.mockResolvedValue({
        id: 'emp-1',
        isActive: true,
        companyId: 'co-1',
        branchId: 'br-1',
        departmentId: 'dept-1',
        designationId: null,
        branch: { timezone: 'Asia/Kolkata' },
      });
      tx.leaveType.findUnique.mockResolvedValue({
        id: 'lt-1',
        isActive: true,
        allowHalfDay: true,
      });
      tx.leavePolicy.findMany.mockResolvedValue([
        {
          id: 'policy-1',
          branchId: 'br-1',
          departmentId: null,
          designationId: null,
          maxConsecutiveDays: null,
          allowNegativeBalance: false,
          maximumNegativeBalance: null,
          annualEntitlement: 12,
        },
      ]);
      tx.branchWorkingDay.findMany.mockResolvedValue([]);
      tx.holiday.findMany.mockResolvedValue([]);
      calendarConsumer.isActiveOffice.mockResolvedValue(false);

      await service.resolveCalculation({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
        fromDate: '2026-08-03',
        toDate: '2026-08-03',
        client: tx as never,
      });

      expect(tx.employee.findUnique).toHaveBeenCalled();
      expect(tx.leavePolicy.findMany).toHaveBeenCalled();
      expect(tx.holiday.findMany).toHaveBeenCalled();
      expect(prisma.employee.findUnique).not.toHaveBeenCalled();
      expect(prisma.leavePolicy.findMany).not.toHaveBeenCalled();
      expect(prisma.holiday.findMany).not.toHaveBeenCalled();
    });
  });
});
