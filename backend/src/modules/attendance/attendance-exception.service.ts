import { Injectable } from '@nestjs/common';
import {
  AttendanceExceptionStatus,
  AttendanceExceptionType,
  Prisma,
  ShiftRosterStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { PrismaTx } from '../workforce-approval/workforce-approval-resolver.service';

import { buildExceptionDedupeKey } from './attendance-roster-metrics.util';
import { calendarDateToUtcMidnight } from './attendance-calendar.util';

export interface UpsertExceptionInput {
  companyId: string;
  branchId: string;
  employeeId: string;
  businessDate: string;
  type: AttendanceExceptionType;
  attendanceId?: string | null;
  shiftRosterEntryId?: string | null;
  details?: Prisma.InputJsonValue;
  detectedAt?: Date;
}

@Injectable()
export class AttendanceExceptionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent exception create. Retries/jobs must not duplicate rows.
   */
  async upsertOpen(
    input: UpsertExceptionInput,
    tx?: PrismaTx,
  ): Promise<{ id: string; created: boolean }> {
    const db = tx ?? this.prisma;
    const dedupeKey = buildExceptionDedupeKey(
      input.employeeId,
      input.businessDate,
      input.type,
    );

    const existing = await db.attendanceException.findUnique({
      where: { dedupeKey },
      select: { id: true },
    });

    if (existing) {
      return { id: existing.id, created: false };
    }

    try {
      const created = await db.attendanceException.create({
        data: {
          companyId: input.companyId,
          branchId: input.branchId,
          employeeId: input.employeeId,
          attendanceId: input.attendanceId ?? null,
          shiftRosterEntryId: input.shiftRosterEntryId ?? null,
          businessDate: calendarDateToUtcMidnight(input.businessDate),
          type: input.type,
          status: AttendanceExceptionStatus.OPEN,
          dedupeKey,
          details: input.details,
          detectedAt: input.detectedAt ?? new Date(),
        },
        select: { id: true },
      });
      return { id: created.id, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const again = await db.attendanceException.findUnique({
          where: { dedupeKey },
          select: { id: true },
        });
        return { id: again!.id, created: false };
      }
      throw error;
    }
  }

  async resolveForAttendance(
    attendanceId: string,
    resolutionCode: string,
    resolvedByUserId: string,
    tx?: PrismaTx,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    await db.attendanceException.updateMany({
      where: {
        attendanceId,
        status: {
          in: [
            AttendanceExceptionStatus.OPEN,
            AttendanceExceptionStatus.SUBMITTED,
          ],
        },
      },
      data: {
        status: AttendanceExceptionStatus.RESOLVED,
        resolvedAt: new Date(),
        resolvedByUserId,
        resolutionCode,
      },
    });
  }

  /**
   * Published or locked roster entry for employee + branch business date.
   * Matches My Workspace shift lookup (employee + date); branch filter is
   * preferred then relaxed so a published HQ roster still links on check-in.
   */
  async findPublishedRosterEntry(
    employeeId: string,
    branchId: string,
    businessDate: string,
  ) {
    const workDate = calendarDateToUtcMidnight(businessDate);
    const published = {
      status: {
        in: [ShiftRosterStatus.PUBLISHED, ShiftRosterStatus.LOCKED],
      },
    };

    const onBranch = await this.prisma.shiftRosterEntry.findFirst({
      where: {
        employeeId,
        branchId,
        workDate,
        shiftRoster: published,
      },
      include: { shift: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (onBranch) {
      return onBranch;
    }

    return this.prisma.shiftRosterEntry.findFirst({
      where: {
        employeeId,
        workDate,
        shiftRoster: published,
      },
      include: { shift: true },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
