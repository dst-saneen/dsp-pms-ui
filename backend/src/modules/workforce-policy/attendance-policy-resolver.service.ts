import { Injectable } from '@nestjs/common';
import { AttendancePolicy, Prisma } from '@prisma/client';

import { WorkforcePolicyDefaults } from '../../common/constants/workforce-time-contracts';
import { PrismaService } from '../../prisma/prisma.service';

export type AttendancePolicySource = 'BRANCH' | 'COMPANY' | 'SYSTEM_DEFAULT';

export interface ResolveAttendancePolicyInput {
  companyId: string;
  branchId?: string | null;
  /** Business date (calendar day). Time component is ignored via UTC date. */
  asOfDate: Date | string;
}

export interface ResolvedAttendancePolicy {
  source: AttendancePolicySource;
  policyId: string | null;
  companyId: string;
  branchId: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  lateGraceMinutes: number;
  earlyDepartureGraceMinutes: number;
  fullDayThresholdPercent: number;
  halfDayThresholdPercent: number;
  regularizationWindowDays: number;
  leaveBackdateWindowDays: number;
  finalizationDelayMinutes: number;
  maxOpenShiftMinutes: number;
  latePenaltyEnabled: boolean;
  automaticLeaveDeductionEnabled: boolean;
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
  policy: AttendancePolicy,
  source: 'BRANCH' | 'COMPANY',
): ResolvedAttendancePolicy {
  return {
    source,
    policyId: policy.id,
    companyId: policy.companyId,
    branchId: policy.branchId,
    effectiveFrom: policy.effectiveFrom,
    effectiveTo: policy.effectiveTo,
    lateGraceMinutes: policy.lateGraceMinutes,
    earlyDepartureGraceMinutes: policy.earlyDepartureGraceMinutes,
    fullDayThresholdPercent: policy.fullDayThresholdPercent,
    halfDayThresholdPercent: policy.halfDayThresholdPercent,
    regularizationWindowDays: policy.regularizationWindowDays,
    leaveBackdateWindowDays: policy.leaveBackdateWindowDays,
    finalizationDelayMinutes: policy.finalizationDelayMinutes,
    maxOpenShiftMinutes: policy.maxOpenShiftMinutes,
    latePenaltyEnabled: policy.latePenaltyEnabled,
    automaticLeaveDeductionEnabled: policy.automaticLeaveDeductionEnabled,
  };
}

function systemDefault(
  companyId: string,
  branchId: string | null,
): ResolvedAttendancePolicy {
  return {
    source: 'SYSTEM_DEFAULT',
    policyId: null,
    companyId,
    branchId,
    effectiveFrom: null,
    effectiveTo: null,
    lateGraceMinutes: WorkforcePolicyDefaults.lateGraceMinutes,
    earlyDepartureGraceMinutes:
      WorkforcePolicyDefaults.earlyDepartureGraceMinutes,
    fullDayThresholdPercent: WorkforcePolicyDefaults.fullDayThresholdPercent,
    halfDayThresholdPercent: WorkforcePolicyDefaults.halfDayThresholdPercent,
    regularizationWindowDays: WorkforcePolicyDefaults.regularizationWindowDays,
    leaveBackdateWindowDays: WorkforcePolicyDefaults.leaveBackdateWindowDays,
    finalizationDelayMinutes: WorkforcePolicyDefaults.finalizationDelayMinutes,
    maxOpenShiftMinutes: WorkforcePolicyDefaults.maxOpenShiftMinutes,
    latePenaltyEnabled: false,
    automaticLeaveDeductionEnabled: false,
  };
}

@Injectable()
export class AttendancePolicyResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Precedence (plan §6.8): Branch → Company → immutable system default.
   * Within a scope, the latest effectiveFrom that covers asOfDate wins.
   */
  async resolve(
    input: ResolveAttendancePolicyInput,
  ): Promise<ResolvedAttendancePolicy> {
    const asOf = toUtcDateOnly(input.asOfDate);
    const branchId = input.branchId?.trim() || null;

    const whereBase: Prisma.AttendancePolicyWhereInput = {
      companyId: input.companyId,
      isActive: true,
      effectiveFrom: { lte: asOf },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
    };

    if (branchId) {
      const branchPolicy = await this.prisma.attendancePolicy.findFirst({
        where: { ...whereBase, branchId },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (branchPolicy) {
        return mapPolicy(branchPolicy, 'BRANCH');
      }
    }

    const companyPolicy = await this.prisma.attendancePolicy.findFirst({
      where: { ...whereBase, branchId: null },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (companyPolicy) {
      return mapPolicy(companyPolicy, 'COMPANY');
    }

    return systemDefault(input.companyId, branchId);
  }
}
