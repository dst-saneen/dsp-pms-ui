import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeavePolicy, Prisma } from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessCalendarConsumerService } from '../business-calendar/business-calendar-consumer.service';

import {
  DEFAULT_WORKING_DAYS_OF_WEEK,
  dayOfWeekForCalendarDate,
  enumerateCalendarDates,
  isValidIanaTimeZone,
  toCalendarDate,
} from './leave-calendar.util';
import {
  scoreLeavePolicy,
  type LeavePolicyMatchTier,
} from './leave-policy-specificity';

export type { LeavePolicyMatchTier };

export interface ResolveLeaveCalculationInput {
  employeeId: string;
  leaveTypeId: string;
  fromDate: Date | string;
  toDate: Date | string;
  isHalfDay?: boolean;
  /** Optional override; otherwise BranchWorkingDay rows are loaded (D3-02). */
  workingDaysOfWeek?: readonly number[];
  /** When set, policy and calendar reads use the same transaction as balance reserve. */
  client?: Prisma.TransactionClient;
}

export interface LeaveCalculationResult {
  employeeId: string;
  leaveTypeId: string;
  policyId: string;
  policyTier: LeavePolicyMatchTier;
  timezone: string;
  fromCalendarDate: string;
  toCalendarDate: string;
  requestedWorkingDays: number;
  excludedHolidays: string[];
  excludedNonWorkingDays: string[];
  maxConsecutiveDays: number | null;
  allowNegativeBalance: boolean;
  maximumNegativeBalance: number | null;
  annualEntitlement: number;
  /** Present when office Business Calendar mode is ACTIVE. */
  runtimeDaySnapshots?: Array<{
    businessDate: string;
    runtimeDayId: string | null;
    dayPortion: string;
    chargedDays: number;
    calculationStatus: string;
  }>;
  calendarRuntimeMode?: string;
}

type PolicyCandidate = LeavePolicy & {
  tier: LeavePolicyMatchTier;
  specificity: number;
};

@Injectable()
export class LeavePolicyResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarConsumer: BusinessCalendarConsumerService,
  ) {}

  async resolveCalculation(
    input: ResolveLeaveCalculationInput,
  ): Promise<LeaveCalculationResult> {
    const db = input.client ?? this.prisma;

    const employee = await db.employee.findUnique({
      where: { id: input.employeeId },
      include: {
        branch: true,
      },
    });

    if (!employee || !employee.isActive) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }

    const leaveType = await db.leaveType.findUnique({
      where: { id: input.leaveTypeId },
    });

    if (!leaveType || !leaveType.isActive) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Leave type not found',
      });
    }

    const timezone = employee.branch.timezone?.trim() ?? '';
    if (!timezone || !isValidIanaTimeZone(timezone)) {
      throw new BadRequestException({
        code: WorkforceErrorCode.BRANCH_TIMEZONE_REQUIRED,
        message:
          'Branch timezone must be a valid IANA timezone before leave can be calculated.',
      });
    }

    const fromCalendarDate = toCalendarDate(input.fromDate, timezone);
    const untilCalendarDate = toCalendarDate(input.toDate, timezone);

    if (fromCalendarDate > untilCalendarDate) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'From date cannot be greater than to date',
      });
    }

    const isHalfDay = Boolean(input.isHalfDay);
    if (isHalfDay) {
      if (!leaveType.allowHalfDay) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Half-day leave is not permitted for this leave type',
        });
      }
      if (fromCalendarDate !== untilCalendarDate) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message: 'Half-day leave must start and end on the same calendar day',
        });
      }
    }

    const policy = await this.resolvePolicy(
      {
        companyId: employee.companyId,
        branchId: employee.branchId,
        departmentId: employee.departmentId,
        designationId: employee.designationId,
        leaveTypeId: leaveType.id,
      },
      input.client,
    );

    const workingDaysOfWeek =
      input.workingDaysOfWeek ??
      (await this.loadBranchWorkingDays(employee.branchId, input.client));

    const activeOffice = await this.calendarConsumer.isActiveOffice(
      employee.companyId,
      employee.branchId,
      input.client,
    );

    const dayBreakdown = activeOffice
      ? await this.calculateWorkingDaysFromRuntime({
          companyId: employee.companyId,
          branchId: employee.branchId,
          fromCalendarDate,
          toCalendarDate: untilCalendarDate,
          isHalfDay,
          client: input.client,
        })
      : await this.calculateWorkingDays({
          companyId: employee.companyId,
          branchId: employee.branchId,
          timezone,
          fromCalendarDate,
          toCalendarDate: untilCalendarDate,
          workingDaysOfWeek,
          isHalfDay,
          client: input.client,
        });

    if (dayBreakdown.requestedWorkingDays <= 0) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message:
          'Leave request has zero working days after excluding holidays and non-working days',
      });
    }

    const maxConsecutiveDays = policy.maxConsecutiveDays;
    if (
      maxConsecutiveDays != null &&
      dayBreakdown.requestedWorkingDays > maxConsecutiveDays
    ) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: `Leave exceeds maximum consecutive days allowed by policy (${maxConsecutiveDays})`,
      });
    }

    return {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      policyId: policy.id,
      policyTier: policy.tier,
      timezone,
      fromCalendarDate,
      toCalendarDate: untilCalendarDate,
      requestedWorkingDays: dayBreakdown.requestedWorkingDays,
      excludedHolidays: dayBreakdown.excludedHolidays,
      excludedNonWorkingDays: dayBreakdown.excludedNonWorkingDays,
      maxConsecutiveDays,
      allowNegativeBalance: policy.allowNegativeBalance,
      maximumNegativeBalance:
        policy.maximumNegativeBalance == null
          ? null
          : Number(policy.maximumNegativeBalance),
      annualEntitlement: Number(policy.annualEntitlement),
      runtimeDaySnapshots: dayBreakdown.runtimeDaySnapshots,
      calendarRuntimeMode: activeOffice ? 'ACTIVE' : 'LEGACY_OR_SHADOW',
    };
  }

  async resolvePolicy(
    params: {
      companyId: string;
      branchId: string;
      departmentId: string | null;
      designationId: string | null;
      leaveTypeId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<PolicyCandidate> {
    const db = client ?? this.prisma;
    const policies = await db.leavePolicy.findMany({
      where: {
        companyId: params.companyId,
        leaveTypeId: params.leaveTypeId,
        isActive: true,
        OR: [
          {
            branchId: null,
            departmentId: null,
            designationId: null,
          },
          {
            branchId: params.branchId,
            OR: [
              {
                departmentId: null,
                designationId: null,
              },
              ...(params.departmentId
                ? [
                    {
                      departmentId: params.departmentId,
                      designationId: null,
                    } satisfies Prisma.LeavePolicyWhereInput,
                  ]
                : []),
              ...(params.designationId
                ? [
                    {
                      departmentId: null,
                      designationId: params.designationId,
                    } satisfies Prisma.LeavePolicyWhereInput,
                  ]
                : []),
              ...(params.departmentId && params.designationId
                ? [
                    {
                      departmentId: params.departmentId,
                      designationId: params.designationId,
                    } satisfies Prisma.LeavePolicyWhereInput,
                  ]
                : []),
            ],
          },
        ],
      },
    });

    const candidates: PolicyCandidate[] = policies
      .filter(
        (policy) =>
          policy.branchId == null || policy.branchId === params.branchId,
      )
      .map((policy) => {
        const scored = scoreLeavePolicy(policy);
        return {
          ...policy,
          tier: scored.tier,
          specificity: scored.specificity,
        };
      });

    if (candidates.length === 0) {
      throw new NotFoundException({
        code: WorkforceErrorCode.LEAVE_POLICY_NOT_FOUND,
        message: 'No active leave policy matches this employee and leave type',
      });
    }

    const bestSpecificity = Math.max(
      ...candidates.map((candidate) => candidate.specificity),
    );
    const best = candidates.filter(
      (candidate) => candidate.specificity === bestSpecificity,
    );

    if (best.length > 1) {
      throw new ConflictException({
        code: WorkforceErrorCode.LEAVE_POLICY_CONFIGURATION_CONFLICT,
        message:
          'Multiple leave policies match at the same specificity; resolve the configuration conflict before continuing',
      });
    }

    return best[0];
  }

  private async calculateWorkingDaysFromRuntime(params: {
    companyId: string;
    branchId: string;
    fromCalendarDate: string;
    toCalendarDate: string;
    isHalfDay: boolean;
    client?: Prisma.TransactionClient;
  }): Promise<{
    requestedWorkingDays: number;
    excludedHolidays: string[];
    excludedNonWorkingDays: string[];
    runtimeDaySnapshots: Array<{
      businessDate: string;
      runtimeDayId: string | null;
      dayPortion: string;
      chargedDays: number;
      calculationStatus: string;
    }>;
  }> {
    const days = await this.calendarConsumer.resolveConsumerDays({
      companyId: params.companyId,
      branchId: params.branchId,
      from: params.fromCalendarDate,
      to: params.toCalendarDate,
      client: params.client,
    });
    const summary = this.calendarConsumer.summarizeLeaveDays(
      days,
      params.isHalfDay,
    );
    return {
      requestedWorkingDays: summary.requestedWorkingDays,
      excludedHolidays: summary.excludedHolidays,
      excludedNonWorkingDays: summary.excludedNonWorkingDays,
      runtimeDaySnapshots: summary.snapshots,
    };
  }

  private async calculateWorkingDays(params: {
    companyId: string;
    branchId: string;
    timezone: string;
    fromCalendarDate: string;
    toCalendarDate: string;
    workingDaysOfWeek: readonly number[];
    isHalfDay: boolean;
    client?: Prisma.TransactionClient;
  }): Promise<{
    requestedWorkingDays: number;
    excludedHolidays: string[];
    excludedNonWorkingDays: string[];
    runtimeDaySnapshots?: undefined;
  }> {
    const db = params.client ?? this.prisma;
    const calendarDates = enumerateCalendarDates(
      params.fromCalendarDate,
      params.toCalendarDate,
    );

    const holidays = await db.holiday.findMany({
      where: {
        companyId: params.companyId,
        isActive: true,
        OR: [{ branchId: null }, { branchId: params.branchId }],
      },
      select: {
        holidayDate: true,
      },
    });

    const holidaySet = new Set(
      holidays.map((holiday) =>
        toCalendarDate(holiday.holidayDate, params.timezone),
      ),
    );

    const workingDaySet = new Set(params.workingDaysOfWeek);
    const excludedHolidays: string[] = [];
    const excludedNonWorkingDays: string[] = [];
    let workingDayCount = 0;

    for (const calendarDate of calendarDates) {
      if (holidaySet.has(calendarDate)) {
        excludedHolidays.push(calendarDate);
        continue;
      }

      const dayOfWeek = dayOfWeekForCalendarDate(calendarDate);
      if (!workingDaySet.has(dayOfWeek)) {
        excludedNonWorkingDays.push(calendarDate);
        continue;
      }

      workingDayCount += 1;
    }

    if (params.isHalfDay) {
      if (workingDayCount !== 1) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message:
            'Half-day leave must fall on a single working day that is not a holiday',
        });
      }
      return {
        requestedWorkingDays: 0.5,
        excludedHolidays,
        excludedNonWorkingDays,
      };
    }

    return {
      requestedWorkingDays: workingDayCount,
      excludedHolidays,
      excludedNonWorkingDays,
    };
  }

  private async loadBranchWorkingDays(
    branchId: string,
    client?: Prisma.TransactionClient,
  ): Promise<number[]> {
    const db = client ?? this.prisma;
    const rows = await db.branchWorkingDay.findMany({
      where: { branchId, isWorkingDay: true },
      select: { dayOfWeek: true },
      orderBy: { dayOfWeek: 'asc' },
    });

    if (rows.length === 0) {
      return [...DEFAULT_WORKING_DAYS_OF_WEEK];
    }

    return rows.map((row) => row.dayOfWeek);
  }
}
