import { Injectable } from '@nestjs/common';
import { CareerEventType, EmployeeCareerEvent, Prisma } from '@prisma/client';

import { getRequestActor, getRequestId } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';

export interface AppendCareerEventInput {
  employeeId: string;
  eventType: CareerEventType;
  eventAt: Date;
  employeeVisibleSummary: string;
  hrDetailReference?: string | null;
  sourceModule: string;
  sourceRecordId: string;
  actorUserId?: string | null;
  auditReference?: string | null;
}

@Injectable()
export class CareerEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
  ) {}

  async append(
    input: AppendCareerEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<EmployeeCareerEvent> {
    await this.assertEmployeeInScope(input.employeeId, tx);

    const actor = getRequestActor();
    const db = tx ?? this.prisma;

    const event = await db.employeeCareerEvent.create({
      data: {
        employeeId: input.employeeId,
        eventType: input.eventType,
        eventAt: input.eventAt,
        employeeVisibleSummary: input.employeeVisibleSummary,
        hrDetailReference: input.hrDetailReference ?? null,
        sourceModule: input.sourceModule,
        sourceRecordId: input.sourceRecordId,
        actorUserId: input.actorUserId ?? actor.userId ?? null,
        auditReference: input.auditReference ?? getRequestId() ?? null,
      },
    });

    await this.auditService.log(
      'EmployeeCareerEvent',
      event.id,
      'APPEND',
      null,
      {
        employeeId: event.employeeId,
        eventType: event.eventType,
        eventAt: event.eventAt.toISOString(),
        sourceModule: event.sourceModule,
        sourceRecordId: event.sourceRecordId,
      },
      { tx, userId: input.actorUserId ?? actor.userId },
    );

    return event;
  }

  private async assertEmployeeInScope(
    employeeId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const db = tx ?? this.prisma;
    const employee = await db.employee.findFirst({
      where: {
        id: employeeId,
        ...this.scopeService.employeeWhere(),
      },
      select: { id: true },
    });

    if (!employee) {
      await this.scopeService.assertEmployeeInScope(employeeId);
    }
  }
}
