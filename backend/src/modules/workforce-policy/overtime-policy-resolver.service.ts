import { Injectable } from '@nestjs/common';
import { OvertimePolicy, OvertimeRoundingMode, Prisma } from '@prisma/client';

import { WorkforcePolicyDefaults } from '../../common/constants/workforce-time-contracts';
import { PrismaService } from '../../prisma/prisma.service';

export type OvertimePolicySource = 'BRANCH' | 'COMPANY' | 'SYSTEM_DEFAULT';

export interface ResolveOvertimePolicyInput {
  companyId: string;
  branchId?: string | null;
  asOfDate: Date | string;
}

export interface ResolvedOvertimePolicy {
  source: OvertimePolicySource;
  policyId: string | null;
  companyId: string;
  branchId: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  minimumEligibleMinutes: number;
  roundingMinutes: number;
  roundingMode: OvertimeRoundingMode;
  includeEarlyArrival: boolean;
  requireScheduledMinutesFulfilled: boolean;
  allowCompOff: boolean;
  allowPayrollPending: boolean;
  compOffHalfDayMinutes: number;
  compOffFullDayMinutes: number;
  maxCompOffDaysPerSource: number;
  compOffExpiryDays: number;
  maxDailyMinutes: number | null;
  maxMonthlyMinutes: number | null;
  requiresApproval: boolean;
}

function toUtcDateOnly(value: Date | string): Date {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (match) {
      return new Date(
        Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
      );
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

function mapPolicy(
  policy: OvertimePolicy,
  source: 'BRANCH' | 'COMPANY',
): ResolvedOvertimePolicy {
  return {
    source,
    policyId: policy.id,
    companyId: policy.companyId,
    branchId: policy.branchId,
    effectiveFrom: policy.effectiveFrom,
    effectiveTo: policy.effectiveTo,
    minimumEligibleMinutes: policy.minimumEligibleMinutes,
    roundingMinutes: policy.roundingMinutes,
    roundingMode: policy.roundingMode,
    includeEarlyArrival: policy.includeEarlyArrival,
    requireScheduledMinutesFulfilled: policy.requireScheduledMinutesFulfilled,
    allowCompOff: policy.allowCompOff,
    allowPayrollPending: policy.allowPayrollPending,
    compOffHalfDayMinutes: policy.compOffHalfDayMinutes,
    compOffFullDayMinutes: policy.compOffFullDayMinutes,
    maxCompOffDaysPerSource: Number(policy.maxCompOffDaysPerSource),
    compOffExpiryDays: policy.compOffExpiryDays,
    maxDailyMinutes: policy.maxDailyMinutes,
    maxMonthlyMinutes: policy.maxMonthlyMinutes,
    requiresApproval: policy.requiresApproval,
  };
}

function systemDefault(
  companyId: string,
  branchId: string | null,
): ResolvedOvertimePolicy {
  return {
    source: 'SYSTEM_DEFAULT',
    policyId: null,
    companyId,
    branchId,
    effectiveFrom: null,
    effectiveTo: null,
    minimumEligibleMinutes:
      WorkforcePolicyDefaults.overtimeMinimumEligibleMinutes,
    roundingMinutes: WorkforcePolicyDefaults.overtimeRoundingMinutes,
    roundingMode: OvertimeRoundingMode.DOWN,
    includeEarlyArrival: false,
    requireScheduledMinutesFulfilled: true,
    allowCompOff: true,
    allowPayrollPending: true,
    compOffHalfDayMinutes: WorkforcePolicyDefaults.compOffHalfDayMinutes,
    compOffFullDayMinutes: WorkforcePolicyDefaults.compOffFullDayMinutes,
    maxCompOffDaysPerSource: WorkforcePolicyDefaults.maxCompOffDaysPerSource,
    compOffExpiryDays: WorkforcePolicyDefaults.compOffExpiryDays,
    maxDailyMinutes: null,
    maxMonthlyMinutes: null,
    requiresApproval: true,
  };
}

@Injectable()
export class OvertimePolicyResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Same precedence as Attendance: Branch → Company → system default.
   */
  async resolve(
    input: ResolveOvertimePolicyInput,
  ): Promise<ResolvedOvertimePolicy> {
    const asOf = toUtcDateOnly(input.asOfDate);
    const branchId = input.branchId?.trim() || null;

    const whereBase: Prisma.OvertimePolicyWhereInput = {
      companyId: input.companyId,
      isActive: true,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    };

    if (branchId) {
      const branchPolicy = await this.prisma.overtimePolicy.findFirst({
        where: { ...whereBase, branchId },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (branchPolicy) {
        return mapPolicy(branchPolicy, 'BRANCH');
      }
    }

    const companyPolicy = await this.prisma.overtimePolicy.findFirst({
      where: { ...whereBase, branchId: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (companyPolicy) {
      return mapPolicy(companyPolicy, 'COMPANY');
    }

    return systemDefault(input.companyId, branchId);
  }
}
