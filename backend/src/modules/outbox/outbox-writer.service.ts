import { Injectable, Logger } from '@nestjs/common';
import { OutboxEventStatus, Prisma } from '@prisma/client';

export type PrismaTx = Prisma.TransactionClient;

/** Keys allowed in outbox payloads — never reasons, remarks, or private notes. */
const SAFE_PAYLOAD_KEYS = new Set([
  'rosterId',
  'branchId',
  'companyId',
  'companyGroupId',
  'employeeId',
  'recipientUserIds',
  'periodStart',
  'periodEnd',
  'version',
  'attendanceId',
  'leaveRequestId',
  'overtimeRequestId',
  'compOffCreditId',
  'regularizationId',
  'periodId',
  'businessDate',
  'status',
  'approvedMinutes',
  'settlement',
  'jobOpeningId',
  'jobApplicationId',
  'candidateId',
  'interviewSessionId',
  'jobOfferId',
  'submissionId',
  'eventCode',
  'deliveryAttemptId',
  'onboardingId',
  'onboardingTaskId',
  'recipientUserId',
  'invitationId',
  'userId',
  'assetId',
  'employeeAssetId',
  'licenseAllocationId',
  'assetTransferId',
  'assetCustodyRequestId',
  'assetClearanceItemId',
  'assetClearanceWaiverId',
  'departmentId',
  'dueDate',
  'workLogHeaderId',
  'projectId',
  'taskId',
]);

export interface WriteOutboxEventInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  dedupeKey: string;
  companyGroupId?: string | null;
  companyId?: string | null;
  branchId?: string | null;
  availableAt?: Date;
}

@Injectable()
export class OutboxWriterService {
  private readonly logger = new Logger(OutboxWriterService.name);

  sanitizePayload(payload: Record<string, unknown>): Prisma.InputJsonObject {
    const safe: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (!SAFE_PAYLOAD_KEYS.has(key)) {
        continue;
      }
      if (value === null) {
        continue;
      }
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        safe[key] = value;
      } else if (Array.isArray(value)) {
        safe[key] = value.filter(
          (item) =>
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean',
        );
      } else if (value instanceof Date) {
        safe[key] = value.toISOString();
      }
    }
    return safe;
  }

  async write(
    tx: PrismaTx,
    input: WriteOutboxEventInput,
  ): Promise<{ id: string; created: boolean }> {
    const payload = this.sanitizePayload(input.payload);

    try {
      const row = await tx.outboxEvent.create({
        data: {
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          eventType: input.eventType,
          payload,
          dedupeKey: input.dedupeKey,
          status: OutboxEventStatus.PENDING,
          companyGroupId: input.companyGroupId ?? null,
          companyId: input.companyId ?? null,
          branchId: input.branchId ?? null,
          availableAt: input.availableAt ?? new Date(),
        },
      });
      return { id: row.id, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.debug(
          `Outbox dedupe hit for key=${input.dedupeKey} eventType=${input.eventType}`,
        );
        const existing = await tx.outboxEvent.findUnique({
          where: { dedupeKey: input.dedupeKey },
          select: { id: true },
        });
        return { id: existing?.id ?? input.dedupeKey, created: false };
      }
      throw error;
    }
  }
}
