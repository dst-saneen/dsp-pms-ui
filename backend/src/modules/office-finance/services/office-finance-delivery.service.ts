import { Injectable } from '@nestjs/common';
import { FinancePeriod, FinanceTransaction, Prisma } from '@prisma/client';

import { OutboxWriterService } from '../../outbox/outbox-writer.service';

import {
  OFFICE_FINANCE_DELIVERY_EVENTS,
  type OfficeFinanceDeliveryEventType,
} from '../office-finance-delivery.events';

type DbClient = Prisma.TransactionClient;

const TRANSACTION_EVENT_TYPES = new Set<OfficeFinanceDeliveryEventType>([
  OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_SUBMITTED,
  OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_APPROVED,
  OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_RETURNED,
  OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_CANCELLED,
  OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_REVERSED,
]);

/**
 * Emits only typed lifecycle facts. Recipient IDs, names, reasons, remarks,
 * and financial values are deliberately absent: the Delivery domain rehydrates the
 * aggregate and resolves recipients under the then-current tenant scope.
 */
@Injectable()
export class OfficeFinanceDeliveryService {
  constructor(private readonly outbox: OutboxWriterService) {}

  async writeTransactionLifecycle(
    tx: DbClient,
    transaction: Pick<
      FinanceTransaction,
      'id' | 'companyId' | 'branchId' | 'status' | 'version'
    >,
    eventType: OfficeFinanceDeliveryEventType,
  ): Promise<void> {
    if (!TRANSACTION_EVENT_TYPES.has(eventType)) {
      throw new Error(
        `Unsupported Finance transaction delivery event: ${eventType}`,
      );
    }

    const companyGroupId = await this.companyGroupId(tx, transaction.companyId);
    await this.outbox.write(tx, {
      aggregateType: 'FinanceTransaction',
      aggregateId: transaction.id,
      eventType,
      payload: {
        companyId: transaction.companyId,
        branchId: transaction.branchId,
        status: transaction.status,
        version: transaction.version,
      },
      dedupeKey: `office-finance:transaction:${transaction.id}:${eventType}:v${transaction.version}`,
      companyGroupId,
      companyId: transaction.companyId,
      branchId: transaction.branchId,
    });
  }

  async writePeriodLifecycle(
    tx: DbClient,
    period: Pick<FinancePeriod, 'id' | 'companyId' | 'status' | 'version'>,
    eventType:
      | typeof OFFICE_FINANCE_DELIVERY_EVENTS.PERIOD_LOCKED
      | typeof OFFICE_FINANCE_DELIVERY_EVENTS.PERIOD_REOPENED,
  ): Promise<void> {
    const companyGroupId = await this.companyGroupId(tx, period.companyId);
    await this.outbox.write(tx, {
      aggregateType: 'FinancePeriod',
      aggregateId: period.id,
      eventType,
      payload: {
        companyId: period.companyId,
        periodId: period.id,
        status: period.status,
        version: period.version,
      },
      dedupeKey: `office-finance:period:${period.id}:${eventType}:v${period.version}`,
      companyGroupId,
      companyId: period.companyId,
      branchId: null,
    });
  }

  private async companyGroupId(tx: DbClient, companyId: string) {
    const company = await tx.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { companyGroupId: true },
    });
    return company.companyGroupId;
  }
}
