import { Injectable, Logger } from '@nestjs/common';
import { AttendanceExceptionType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AttendancePolicyResolverService } from '../workforce-policy/attendance-policy-resolver.service';

import { findApprovedFullDayLeaveCovering } from './attendance-approved-leave.util';
import { AttendanceExceptionService } from './attendance-exception.service';
import { toCalendarDate } from './attendance-calendar.util';
import { AttendanceStatus } from './constants';

@Injectable()
export class AttendanceFinalizerService {
  private readonly logger = new Logger(AttendanceFinalizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendancePolicyResolver: AttendancePolicyResolverService,
    private readonly attendanceExceptionService: AttendanceExceptionService,
  ) {}

  /**
   * Finalize eligible open attendances after scheduled end + delay.
   * Bounded batch; safe to retry (idempotent exceptions + finalizedAt guard).
   */
  async finalizeBatch(
    limit = 50,
  ): Promise<{ processed: number; skipped: number }> {
    const now = new Date();
    const candidates = await this.prisma.attendance.findMany({
      where: {
        isActive: true,
        finalizedAt: null,
        scheduledEndAt: { not: null, lte: now },
      },
      include: {
        employee: {
          select: {
            id: true,
            companyId: true,
            branchId: true,
            branch: { select: { timezone: true } },
          },
        },
      },
      take: limit,
      orderBy: { scheduledEndAt: 'asc' },
    });

    let processed = 0;
    let skipped = 0;

    for (const attendance of candidates) {
      try {
        const policy = await this.attendancePolicyResolver.resolve({
          companyId: attendance.employee.companyId,
          branchId: attendance.employee.branchId,
          asOfDate: attendance.attendanceDate,
        });

        const eligibleAt = new Date(
          attendance.scheduledEndAt!.getTime() +
            policy.finalizationDelayMinutes * 60 * 1000,
        );
        if (now < eligibleAt) {
          skipped += 1;
          continue;
        }

        const businessDate = toCalendarDate(attendance.attendanceDate, 'UTC');
        const attendanceDateUtc = attendance.attendanceDate;

        const approvedLeave =
          !attendance.checkInTime && !attendance.checkOutTime
            ? await findApprovedFullDayLeaveCovering(
                this.prisma,
                attendance.employeeId,
                attendanceDateUtc,
              )
            : null;

        const finalStatus = approvedLeave
          ? AttendanceStatus.LEAVE
          : this.resolveFinalStatus(attendance);
        const finalReason = approvedLeave
          ? 'FINALIZED_APPROVED_LEAVE'
          : (attendance.classificationReason ??
            this.resolveFinalReason(attendance));

        await this.prisma.$transaction(async (tx) => {
          const claim = await tx.attendance.updateMany({
            where: {
              id: attendance.id,
              finalizedAt: null,
            },
            data: {
              finalizedAt: now,
              status: finalStatus,
              classificationReason: finalReason,
            },
          });

          if (claim.count !== 1) {
            return;
          }

          if (approvedLeave) {
            return;
          }

          if (!attendance.checkInTime) {
            await this.attendanceExceptionService.upsertOpen(
              {
                companyId: attendance.employee.companyId,
                branchId: attendance.employee.branchId,
                employeeId: attendance.employeeId,
                businessDate,
                type: AttendanceExceptionType.MISSING_CHECK_IN,
                attendanceId: attendance.id,
                shiftRosterEntryId: attendance.shiftRosterEntryId,
              },
              tx,
            );
          } else if (!attendance.checkOutTime) {
            await this.attendanceExceptionService.upsertOpen(
              {
                companyId: attendance.employee.companyId,
                branchId: attendance.employee.branchId,
                employeeId: attendance.employeeId,
                businessDate,
                type: AttendanceExceptionType.MISSING_CHECK_OUT,
                attendanceId: attendance.id,
                shiftRosterEntryId: attendance.shiftRosterEntryId,
              },
              tx,
            );
          }
        });

        processed += 1;
      } catch (error) {
        skipped += 1;
        this.logger.warn(
          `Finalizer skipped attendance ${attendance.id}: ${String(error)}`,
        );
      }
    }

    return { processed, skipped };
  }

  private resolveFinalStatus(attendance: {
    checkInTime: Date | null;
    checkOutTime: Date | null;
    status: string;
    scheduleDayType: string | null;
  }): string {
    if (attendance.scheduleDayType === 'WEEK_OFF') {
      return AttendanceStatus.WEEK_OFF;
    }
    if (attendance.scheduleDayType === 'HOLIDAY') {
      return AttendanceStatus.HOLIDAY;
    }
    if (!attendance.checkInTime && !attendance.checkOutTime) {
      return AttendanceStatus.ABSENT;
    }
    if (attendance.checkInTime && !attendance.checkOutTime) {
      return attendance.status || AttendanceStatus.ABSENT;
    }
    return attendance.status;
  }

  private resolveFinalReason(attendance: {
    checkInTime: Date | null;
    checkOutTime: Date | null;
    scheduleDayType: string | null;
  }): string {
    if (attendance.scheduleDayType === 'WEEK_OFF') return 'FINALIZED_WEEK_OFF';
    if (attendance.scheduleDayType === 'HOLIDAY') return 'FINALIZED_HOLIDAY';
    if (!attendance.checkInTime) return 'FINALIZED_MISSING_CHECK_IN';
    if (!attendance.checkOutTime) return 'FINALIZED_MISSING_CHECK_OUT';
    return 'FINALIZED';
  }
}
