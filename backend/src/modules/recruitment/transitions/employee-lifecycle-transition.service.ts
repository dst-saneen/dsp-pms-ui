import { Injectable } from '@nestjs/common';
import { Employee, Prisma } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
  getRequestActor,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';

import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';
import {
  EMPLOYMENT_STATUS,
  EmploymentStatusValue,
  getAllowedEmployeeLifecycleActions,
  isAllowedEmployeeLifecycleTransition,
} from '../core/recruitment.utils';
import { CareerEventService } from '../services/career-event.service';

export interface EmployeeLifecycleTransitionOptions {
  probationStartDate?: Date;
  probationPlannedEndDate?: Date;
  probationConfirmedByUserId?: string;
  probationConfirmationNote?: string;
  probationOverrideReason?: string;
  tx?: Prisma.TransactionClient;
}

export interface EmployeeLifecycleTransitionResult {
  entity: Employee;
  employmentStatus: string;
  allowedActions: EmploymentStatusValue[];
}

@Injectable()
export class EmployeeLifecycleTransitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
    private readonly careerEventService: CareerEventService,
  ) {}

  async startProbation(
    employeeId: string,
    options: EmployeeLifecycleTransitionOptions = {},
  ): Promise<EmployeeLifecycleTransitionResult> {
    const employee = await this.loadEmployee(employeeId, options.tx);

    return this.transition(
      employee,
      EMPLOYMENT_STATUS.PROBATION,
      options,
      {
        probationStartDate: options.probationStartDate ?? new Date(),
        probationPlannedEndDate: options.probationPlannedEndDate ?? null,
      },
      async (tx, updated) => {
        await this.careerEventService.append(
          {
            employeeId: updated.id,
            eventType: 'PROBATION_STARTED',
            eventAt: options.probationStartDate ?? new Date(),
            employeeVisibleSummary: 'Probation period started.',
            sourceModule: 'recruitment',
            sourceRecordId: updated.id,
            actorUserId: getRequestActor().userId,
          },
          tx,
        );
      },
    );
  }

  async confirmActive(
    employeeId: string,
    options: EmployeeLifecycleTransitionOptions = {},
  ): Promise<EmployeeLifecycleTransitionResult> {
    const employee = await this.loadEmployee(employeeId, options.tx);

    if (employee.probationPlannedEndDate && !options.probationOverrideReason) {
      const today = this.startOfDay(new Date());
      const plannedEnd = this.startOfDay(employee.probationPlannedEndDate);

      if (today < plannedEnd) {
        throw new DomainConflictException(
          RECRUITMENT_ERROR_CODES.PROBATION_TOO_EARLY,
          'Probation cannot be confirmed before the planned end date without an authorized override reason.',
        );
      }
    }

    const actor = getRequestActor();

    return this.transition(
      employee,
      EMPLOYMENT_STATUS.ACTIVE,
      options,
      {
        probationConfirmedAt: new Date(),
        probationConfirmedByUser: options.probationConfirmedByUserId
          ? { connect: { id: options.probationConfirmedByUserId } }
          : actor.userId
            ? { connect: { id: actor.userId } }
            : undefined,
        probationConfirmationNote: options.probationConfirmationNote ?? null,
      },
      async (tx, updated) => {
        await this.careerEventService.append(
          {
            employeeId: updated.id,
            eventType: 'PROBATION_CONFIRMED',
            eventAt: new Date(),
            employeeVisibleSummary: 'Employment confirmed as active.',
            sourceModule: 'recruitment',
            sourceRecordId: updated.id,
            actorUserId: actor.userId,
            hrDetailReference: options.probationOverrideReason ?? null,
          },
          tx,
        );
      },
    );
  }

  private async transition(
    employee: Employee,
    toStatus: EmploymentStatusValue,
    options: EmployeeLifecycleTransitionOptions,
    extraData: Prisma.EmployeeUpdateInput,
    afterUpdate?: (
      tx: Prisma.TransactionClient,
      employee: Employee,
    ) => Promise<void>,
  ): Promise<EmployeeLifecycleTransitionResult> {
    const fromStatus = employee.employmentStatus as EmploymentStatusValue;

    if (!isAllowedEmployeeLifecycleTransition(fromStatus, toStatus)) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.EMPLOYEE_INVALID_TRANSITION,
        `Employee cannot transition from ${employee.employmentStatus} to ${toStatus}.`,
      );
    }

    const run = async (tx: Prisma.TransactionClient) => {
      const updated = await tx.employee.update({
        where: { id: employee.id },
        data: {
          employmentStatus: toStatus,
          ...extraData,
        },
      });

      await this.auditService.log(
        'Employee',
        employee.id,
        `EMPLOYMENT_STATUS_${toStatus}`,
        { employmentStatus: employee.employmentStatus },
        { employmentStatus: updated.employmentStatus },
        { tx, userId: getRequestActor().userId },
      );

      if (afterUpdate) {
        await afterUpdate(tx, updated);
      }

      return updated;
    };

    const updated = options.tx
      ? await run(options.tx)
      : await this.prisma.$transaction(run);

    return {
      entity: updated,
      employmentStatus: updated.employmentStatus,
      allowedActions: getAllowedEmployeeLifecycleActions(
        updated.employmentStatus,
      ),
    };
  }

  private async loadEmployee(
    employeeId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Employee> {
    const db = tx ?? this.prisma;
    const employee = await db.employee.findFirst({
      where: {
        id: employeeId,
        ...this.scopeService.employeeWhere(),
      },
    });

    if (!employee) {
      throw new DomainNotFoundException(
        RECRUITMENT_ERROR_CODES.EMPLOYEE_NOT_FOUND,
        'Employee not found.',
      );
    }

    return employee;
  }

  private startOfDay(value: Date): Date {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
}
