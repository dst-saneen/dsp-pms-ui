import { Injectable } from '@nestjs/common';
import { CareerEventType } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
  getRequestActor,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';
import { AssetCustodyPreflightService } from '../../asset-domain/asset-custody-preflight.service';
import { ASSET_ERROR_CODES } from '../../asset-domain/policies/asset-error-codes';
import { CareerEventService } from '../services/career-event.service';

import {
  ManagerChangeDto,
  PromotionDto,
  TransferDto,
} from './dto/career-action.dto';

@Injectable()
export class EmployeeCareerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: EmployeeDomainScopeService,
    private readonly careerEvents: CareerEventService,
    private readonly assetCustodyPreflight: AssetCustodyPreflightService,
  ) {}

  async getHrCareerTimeline(employeeId: string) {
    await this.scope.assertEmployeeInScope(employeeId);

    const events = await this.prisma.employeeCareerEvent.findMany({
      where: { employeeId },
      orderBy: { eventAt: 'asc' },
    });

    return {
      employeeId,
      view: 'HR' as const,
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        occurredAt: event.eventAt,
        summary: event.employeeVisibleSummary,
        hrDetail: event.hrDetailReference,
        sourceModule: event.sourceModule,
        sourceRecordId: event.sourceRecordId,
      })),
    };
  }

  async getSanitizedSelfCareerTimeline(employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        isActive: true,
      },
      select: { id: true },
    });

    if (!employee) {
      throw new DomainNotFoundException(
        'EMPLOYEE_NOT_FOUND',
        'Employee not found.',
      );
    }

    const events = await this.prisma.employeeCareerEvent.findMany({
      where: { employeeId },
      orderBy: { eventAt: 'asc' },
      select: {
        id: true,
        eventType: true,
        eventAt: true,
        employeeVisibleSummary: true,
        sourceModule: true,
      },
    });

    return {
      employeeId,
      view: 'SANITIZED' as const,
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        occurredAt: event.eventAt,
        summary: event.employeeVisibleSummary,
        sourceModule: event.sourceModule,
      })),
    };
  }

  async recordPromotion(employeeId: string, dto: PromotionDto) {
    await this.scope.assertEmployeeInScope(employeeId);

    const employee = await this.loadEmployee(employeeId);
    const designation = await this.prisma.designation.findFirst({
      where: {
        id: dto.designationId,
        companyId: employee.companyId,
        isActive: true,
      },
    });

    if (!designation) {
      throw new DomainNotFoundException(
        'DESIGNATION_NOT_FOUND',
        'Designation not found.',
      );
    }

    const effectiveDate = new Date(dto.effectiveDate);
    const actor = getRequestActor();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { designationId: dto.designationId },
      });

      await this.careerEvents.append(
        {
          employeeId,
          eventType: CareerEventType.PROMOTION,
          eventAt: effectiveDate,
          employeeVisibleSummary: `Promoted to ${designation.designationName}.`,
          hrDetailReference: dto.note?.trim(),
          sourceModule: 'hr',
          sourceRecordId: employeeId,
          actorUserId: actor.userId,
        },
        tx,
      );

      return updated;
    });
  }

  async recordTransfer(employeeId: string, dto: TransferDto) {
    await this.scope.assertEmployeeInScope(employeeId);

    const employee = await this.loadEmployee(employeeId);

    if (!dto.branchId && !dto.departmentId) {
      throw new DomainConflictException(
        'TRANSFER_TARGET_REQUIRED',
        'At least one of branch or department must be provided.',
      );
    }

    let nextBranchId = dto.branchId ?? employee.branchId;
    let nextDepartmentId = dto.departmentId ?? employee.departmentId;

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: {
          id: dto.departmentId,
          companyId: employee.companyId,
          isActive: true,
        },
      });

      if (!department) {
        throw new DomainNotFoundException(
          'DEPARTMENT_NOT_FOUND',
          'Department not found.',
        );
      }
      nextBranchId = department.branchId;
      nextDepartmentId = department.id;
      if (dto.branchId && dto.branchId !== department.branchId) {
        throw new DomainConflictException(
          ASSET_ERROR_CODES.ASSET_DEPARTMENT_BRANCH_MISMATCH,
          'Transfer Branch must match the selected Department',
        );
      }
    } else if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          id: dto.branchId,
          companyId: employee.companyId,
          isActive: true,
        },
      });

      if (!branch) {
        throw new DomainNotFoundException(
          'BRANCH_NOT_FOUND',
          'Branch not found.',
        );
      }
      nextBranchId = branch.id;
    }

    const effectiveDate = new Date(dto.effectiveDate);
    const actor = getRequestActor();

    return this.prisma.$transaction(async (tx) => {
      await this.assetCustodyPreflight.assertEmployeeMoveAllowed(tx, {
        employeeId,
        fromBranchId: employee.branchId,
        toBranchId: nextBranchId,
      });

      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: {
          branchId: nextBranchId,
          departmentId: nextDepartmentId,
        },
      });

      await this.careerEvents.append(
        {
          employeeId,
          eventType: CareerEventType.TRANSFER,
          eventAt: effectiveDate,
          employeeVisibleSummary: 'Employee transferred to a new assignment.',
          hrDetailReference: dto.note?.trim(),
          sourceModule: 'hr',
          sourceRecordId: employeeId,
          actorUserId: actor.userId,
        },
        tx,
      );

      return updated;
    });
  }

  async recordManagerChange(employeeId: string, dto: ManagerChangeDto) {
    await this.scope.assertEmployeeInScope(employeeId);

    const employee = await this.loadEmployee(employeeId);
    const manager = await this.prisma.employee.findFirst({
      where: {
        id: dto.managerId,
        companyId: employee.companyId,
        isActive: true,
      },
    });

    if (!manager) {
      throw new DomainNotFoundException(
        'MANAGER_NOT_FOUND',
        'Reporting manager not found.',
      );
    }

    const effectiveDate = new Date(dto.effectiveDate);
    const actor = getRequestActor();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { id: employeeId },
        data: { managerId: dto.managerId },
      });

      await this.careerEvents.append(
        {
          employeeId,
          eventType: CareerEventType.MANAGER_CHANGE,
          eventAt: effectiveDate,
          employeeVisibleSummary: 'Reporting manager changed.',
          hrDetailReference: dto.note?.trim(),
          sourceModule: 'hr',
          sourceRecordId: employeeId,
          actorUserId: actor.userId,
        },
        tx,
      );

      return updated;
    });
  }

  private async loadEmployee(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new DomainNotFoundException(
        'EMPLOYEE_NOT_FOUND',
        'Employee not found.',
      );
    }

    return employee;
  }
}
