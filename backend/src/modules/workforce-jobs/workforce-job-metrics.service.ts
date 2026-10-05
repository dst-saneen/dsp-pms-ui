import { Injectable } from '@nestjs/common';

export interface WorkforceJobMetricsSnapshot {
  outboxProcessed: number;
  outboxFailed: number;
  attendanceFinalized: number;
  attendanceSkipped: number;
  compOffExpired: number;
  lastOutboxAt: string | null;
  lastAttendanceFinalizerAt: string | null;
  lastCompOffExpiryAt: string | null;
}

@Injectable()
export class WorkforceJobMetricsService {
  private outboxProcessed = 0;
  private outboxFailed = 0;
  private attendanceFinalized = 0;
  private attendanceSkipped = 0;
  private compOffExpired = 0;
  private lastOutboxAt: Date | null = null;
  private lastAttendanceFinalizerAt: Date | null = null;
  private lastCompOffExpiryAt: Date | null = null;

  recordOutboxProcessed() {
    this.outboxProcessed += 1;
    this.lastOutboxAt = new Date();
  }

  recordOutboxFailed() {
    this.outboxFailed += 1;
    this.lastOutboxAt = new Date();
  }

  recordAttendanceFinalizer(processed: number, skipped: number) {
    this.attendanceFinalized += processed;
    this.attendanceSkipped += skipped;
    this.lastAttendanceFinalizerAt = new Date();
  }

  recordCompOffExpired(count: number) {
    this.compOffExpired += count;
    this.lastCompOffExpiryAt = new Date();
  }

  snapshot(): WorkforceJobMetricsSnapshot {
    return {
      outboxProcessed: this.outboxProcessed,
      outboxFailed: this.outboxFailed,
      attendanceFinalized: this.attendanceFinalized,
      attendanceSkipped: this.attendanceSkipped,
      compOffExpired: this.compOffExpired,
      lastOutboxAt: this.lastOutboxAt?.toISOString() ?? null,
      lastAttendanceFinalizerAt:
        this.lastAttendanceFinalizerAt?.toISOString() ?? null,
      lastCompOffExpiryAt: this.lastCompOffExpiryAt?.toISOString() ?? null,
    };
  }
}
