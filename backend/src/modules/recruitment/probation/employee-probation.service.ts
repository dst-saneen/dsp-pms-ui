import { Injectable } from '@nestjs/common';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';
import { EmployeeLifecycleTransitionService } from '../transitions/employee-lifecycle-transition.service';
import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';

@Injectable()
export class EmployeeProbationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: EmployeeDomainScopeService,
    private readonly lifecycleTransitions: EmployeeLifecycleTransitionService,
  ) {}

  async listProbationDue(
    asOf = new Date(),
    options?: { includeUpcoming?: boolean; permissions?: string[] },
  ) {
    const canOverride = Boolean(
      options?.permissions?.includes('hr.recruitment.probation.override'),
    );
    const includeUpcoming = Boolean(options?.includeUpcoming && canOverride);

    const employees = await this.prisma.employee.findMany({
      where: {
        employmentStatus: 'PROBATION',
        isActive: true,
        probationPlannedEndDate: includeUpcoming
          ? { not: null }
          : { lte: asOf },
        probationConfirmedAt: null,
        ...this.scope.employeeWhere(),
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        email: true,
        probationStartDate: true,
        probationPlannedEndDate: true,
        company: { select: { companyName: true } },
        branch: { select: { branchName: true } },
        department: { select: { departmentName: true } },
        designation: { select: { designationName: true } },
      },
      orderBy: { probationPlannedEndDate: 'asc' },
    });

    return {
      asOf,
      count: employees.length,
      employees: employees.map((employee) => {
        const plannedEnd = employee.probationPlannedEndDate;
        const due = Boolean(
          plannedEnd && plannedEnd.getTime() <= asOf.getTime(),
        );

        return {
          ...employee,
          employeeId: employee.id,
          canConfirmActive: due,
          allowEarlyOverride: canOverride && !due,
          confirmBlockedReason: due
            ? undefined
            : 'Confirmation is available on or after the planned probation end date.',
        };
      }),
    };
  }

  async confirmActive(
    employeeId: string,
    actorUserId: string,
    input: {
      note?: string;
      override?: boolean;
      overrideReason?: string;
      permissions: string[];
    },
  ) {
    await this.scope.assertEmployeeInScope(employeeId);

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new DomainNotFoundException(
        'EMPLOYEE_NOT_FOUND',
        'Employee not found.',
      );
    }

    if (employee.probationConfirmedAt) {
      throw new DomainConflictException(
        'PROBATION_ALREADY_CONFIRMED',
        'Probation has already been confirmed.',
      );
    }

    if (input.override) {
      if (!input.permissions.includes('hr.recruitment.probation.override')) {
        throw new DomainConflictException(
          RECRUITMENT_ERROR_CODES.PROBATION_OVERRIDE_FORBIDDEN,
          'Early probation confirmation requires a distinct override permission.',
        );
      }

      const reason = input.overrideReason?.trim();
      if (!reason || reason.length < 12) {
        throw new DomainConflictException(
          RECRUITMENT_ERROR_CODES.PROBATION_OVERRIDE_REASON_REQUIRED,
          'A structured override reason is required for early confirmation.',
        );
      }

      return this.lifecycleTransitions.confirmActive(employeeId, {
        probationConfirmedByUserId: actorUserId,
        probationConfirmationNote: input.note,
        probationOverrideReason: reason,
      });
    }

    return this.lifecycleTransitions.confirmActive(employeeId, {
      probationConfirmedByUserId: actorUserId,
      probationConfirmationNote: input.note,
    });
  }
}
