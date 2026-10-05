import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { getOrganizationScope } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';

type OrgScope = ReturnType<typeof getOrganizationScope>;

/**
 * Record-level tenant scope for employee-domain entities
 * (Employee, Onboarding, Documents, Assets, Templates).
 * Global organization guard only validates explicit company/branch IDs in the request.
 */
@Injectable()
export class EmployeeDomainScopeService {
  constructor(private readonly prisma: PrismaService) {}

  current(): OrgScope {
    return getOrganizationScope();
  }

  /**
   * Prisma filter for Employee (and any model with companyId + branchId).
   */
  employeeWhere(): Prisma.EmployeeWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        companyId: scope.activeCompanyId,
        branchId: scope.activeBranchId,
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    // Non-global without company context cannot see employee records.
    return {
      id: '__no_scope__',
    };
  }

  /**
   * Filter for models keyed by companyId (templates, document categories/types).
   */
  companyWhere(): Prisma.CompanyWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        companyGroupId: scope.activeCompanyGroupId,
      };
    }

    if (scope.activeCompanyId) {
      return {
        id: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  companyIdFilter(): Prisma.EmployeeOnboardingWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        companyId: scope.activeCompanyId,
        employee: {
          branchId: scope.activeBranchId,
        },
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  onboardingWhere(): Prisma.EmployeeOnboardingWhereInput {
    return this.companyIdFilter();
  }

  onboardingTaskWhere(): Prisma.EmployeeOnboardingTaskWhereInput {
    return {
      onboarding: this.onboardingWhere(),
    };
  }

  onboardingTemplateWhere(): Prisma.OnboardingTemplateWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  onboardingTemplateVersionWhere(): Prisma.OnboardingTemplateVersionWhereInput {
    return {
      onboardingTemplate: this.onboardingTemplateWhere(),
    };
  }

  onboardingTemplateTaskWhere(): Prisma.OnboardingTemplateTaskWhereInput {
    return {
      onboardingTemplate: this.onboardingTemplateWhere(),
    };
  }

  documentWhere(): Prisma.EmployeeDocumentWhereInput {
    return {
      employee: this.employeeWhere(),
    };
  }

  documentCategoryWhere(): Prisma.EmployeeDocumentCategoryWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  documentTypeWhere(): Prisma.EmployeeDocumentTypeWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  assetWhere(): Prisma.AssetWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        companyId: scope.activeCompanyId,
        branchId: scope.activeBranchId,
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  departmentWhere(): Prisma.DepartmentWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        companyId: scope.activeCompanyId,
        branchId: scope.activeBranchId,
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return { id: '__no_scope__' };
  }

  branchWhere(): Prisma.BranchWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        id: scope.activeBranchId,
        companyId: scope.activeCompanyId,
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return { id: '__no_scope__' };
  }

  designationWhere(): Prisma.DesignationWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return { id: '__no_scope__' };
  }

  assetCategoryWhere(): Prisma.AssetCategoryWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.activeCompanyId) {
      return { companyId: scope.activeCompanyId };
    }

    return { id: '__no_scope__' };
  }

  assetTypeWhere(): Prisma.AssetTypeWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.activeCompanyId) {
      return { companyId: scope.activeCompanyId };
    }

    return { id: '__no_scope__' };
  }

  employeeAssetWhere(): Prisma.EmployeeAssetWhereInput {
    return {
      employee: this.employeeWhere(),
    };
  }

  attendanceWhere(): Prisma.AttendanceWhereInput {
    return {
      employee: this.employeeWhere(),
    };
  }

  leaveRequestWhere(): Prisma.LeaveRequestWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (
      scope.scopeLevel === 'BRANCH' &&
      scope.activeCompanyId &&
      scope.activeBranchId
    ) {
      return {
        companyId: scope.activeCompanyId,
        employee: { branchId: scope.activeBranchId },
      };
    }

    if (scope.activeCompanyId) {
      return { companyId: scope.activeCompanyId };
    }

    return { id: '__no_scope__' };
  }

  hrRequestWhere(): Prisma.HrRequestWhereInput {
    const scope = this.current();
    if (scope.isGlobal) return {};
    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return { company: { companyGroupId: scope.activeCompanyGroupId } };
    }
    if (
      scope.scopeLevel === 'BRANCH' &&
      scope.activeCompanyId &&
      scope.activeBranchId
    ) {
      return {
        companyId: scope.activeCompanyId,
        branchId: scope.activeBranchId,
      };
    }
    if (scope.activeCompanyId) return { companyId: scope.activeCompanyId };
    return { id: '__no_scope__' };
  }

  employeeSeparationWhere(): Prisma.EmployeeSeparationWhereInput {
    const scope = this.current();
    if (scope.isGlobal) return {};
    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return { company: { companyGroupId: scope.activeCompanyGroupId } };
    }
    if (
      scope.scopeLevel === 'BRANCH' &&
      scope.activeCompanyId &&
      scope.activeBranchId
    ) {
      return {
        companyId: scope.activeCompanyId,
        branchId: scope.activeBranchId,
      };
    }
    if (scope.activeCompanyId) return { companyId: scope.activeCompanyId };
    return { id: '__no_scope__' };
  }

  employeeClearanceWhere(): Prisma.EmployeeClearanceWhereInput {
    const scope = this.current();
    if (scope.isGlobal) return {};
    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return { company: { companyGroupId: scope.activeCompanyGroupId } };
    }
    if (
      scope.scopeLevel === 'BRANCH' &&
      scope.activeCompanyId &&
      scope.activeBranchId
    ) {
      return {
        companyId: scope.activeCompanyId,
        branchId: scope.activeBranchId,
      };
    }
    if (scope.activeCompanyId) return { companyId: scope.activeCompanyId };
    return { id: '__no_scope__' };
  }

  leaveBalanceWhere(): Prisma.EmployeeLeaveBalanceWhereInput {
    return {
      employee: this.employeeWhere(),
    };
  }

  leaveTypeWhere(): Prisma.LeaveTypeWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  leavePolicyWhere(): Prisma.LeavePolicyWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        companyId: scope.activeCompanyId,
        branchId: scope.activeBranchId,
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  holidayWhere(): Prisma.HolidayWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        companyId: scope.activeCompanyId,
        OR: [
          { branchId: scope.activeBranchId },
          { branchId: { equals: null } },
        ],
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  /** Company + required branch scope (rosters, periods, exceptions). */
  companyBranchWhere(): {
    companyId?: string;
    branchId?: string;
    company?: { companyGroupId: string };
    id?: string;
  } {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        companyId: scope.activeCompanyId,
        branchId: scope.activeBranchId,
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  shiftRosterWhere(): Prisma.ShiftRosterWhereInput {
    return this.companyBranchWhere();
  }

  shiftRosterEntryWhere(): Prisma.ShiftRosterEntryWhereInput {
    return this.companyBranchWhere();
  }

  attendancePolicyWhere(): Prisma.AttendancePolicyWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        companyId: scope.activeCompanyId,
        OR: [{ branchId: scope.activeBranchId }, { branchId: null }],
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  attendanceExceptionWhere(): Prisma.AttendanceExceptionWhereInput {
    return this.companyBranchWhere();
  }

  attendanceRegularizationWhere(): Prisma.AttendanceRegularizationWhereInput {
    return this.companyBranchWhere();
  }

  attendancePeriodWhere(): Prisma.AttendancePeriodWhereInput {
    return this.companyBranchWhere();
  }

  overtimePolicyWhere(): Prisma.OvertimePolicyWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        company: {
          companyGroupId: scope.activeCompanyGroupId,
        },
      };
    }

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        companyId: scope.activeCompanyId,
        OR: [{ branchId: scope.activeBranchId }, { branchId: null }],
      };
    }

    if (scope.activeCompanyId) {
      return {
        companyId: scope.activeCompanyId,
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  overtimeRequestWhere(): Prisma.OvertimeRequestWhereInput {
    return this.companyBranchWhere();
  }

  compOffCreditWhere(): Prisma.CompOffCreditWhereInput {
    return this.companyBranchWhere();
  }

  leaveBalanceTransactionWhere(): Prisma.LeaveBalanceTransactionWhereInput {
    return this.companyBranchWhere();
  }

  userNotificationWhere(): Prisma.UserNotificationWhereInput {
    const scope = this.current();

    if (scope.isGlobal) {
      return {};
    }

    // Notifications are user-owned; tenant filters apply via companyId when set.
    if (scope.scopeLevel === 'COMPANY_GROUP' && scope.activeCompanyGroupId) {
      return {
        OR: [
          { companyId: null },
          {
            company: {
              companyGroupId: scope.activeCompanyGroupId,
            },
          },
        ],
      };
    }

    if (scope.activeCompanyId) {
      return {
        OR: [{ companyId: null }, { companyId: scope.activeCompanyId }],
      };
    }

    return {
      id: '__no_scope__',
    };
  }

  notFound(entity = 'Record'): never {
    throw new NotFoundException(`${entity} not found`);
  }

  async assertShiftRosterInScope(shiftRosterId: string) {
    const roster = await this.prisma.shiftRoster.findFirst({
      where: {
        id: shiftRosterId,
        ...this.shiftRosterWhere(),
      },
      select: { id: true },
    });

    if (!roster) {
      this.notFound('Shift roster');
    }

    return roster;
  }

  async assertAttendanceExceptionInScope(exceptionId: string) {
    const row = await this.prisma.attendanceException.findFirst({
      where: {
        id: exceptionId,
        ...this.attendanceExceptionWhere(),
      },
      select: { id: true },
    });

    if (!row) {
      this.notFound('Attendance exception');
    }

    return row;
  }

  async assertAttendanceRegularizationInScope(regularizationId: string) {
    const row = await this.prisma.attendanceRegularization.findFirst({
      where: {
        id: regularizationId,
        ...this.attendanceRegularizationWhere(),
      },
      select: { id: true },
    });

    if (!row) {
      this.notFound('Attendance regularization');
    }

    return row;
  }

  async assertAttendancePeriodInScope(periodId: string) {
    const row = await this.prisma.attendancePeriod.findFirst({
      where: {
        id: periodId,
        ...this.attendancePeriodWhere(),
      },
      select: { id: true },
    });

    if (!row) {
      this.notFound('Attendance period');
    }

    return row;
  }

  async assertOvertimeRequestInScope(overtimeRequestId: string) {
    const row = await this.prisma.overtimeRequest.findFirst({
      where: {
        id: overtimeRequestId,
        ...this.overtimeRequestWhere(),
      },
      select: { id: true },
    });

    if (!row) {
      this.notFound('Overtime request');
    }

    return row;
  }

  async assertCompOffCreditInScope(compOffCreditId: string) {
    const row = await this.prisma.compOffCredit.findFirst({
      where: {
        id: compOffCreditId,
        ...this.compOffCreditWhere(),
      },
      select: { id: true },
    });

    if (!row) {
      this.notFound('Comp-off credit');
    }

    return row;
  }

  async assertEmployeeInScope(employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        ...this.employeeWhere(),
      },
    });

    if (!employee) {
      this.notFound('Employee');
    }

    return employee;
  }

  async assertCompanyInScope(companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: {
        id: companyId,
        ...this.companyWhere(),
      },
      select: { id: true },
    });

    if (!company) {
      this.notFound('Company');
    }

    return company;
  }

  async assertDepartmentInScope(
    departmentId: string,
    expectedCompanyId?: string,
    expectedBranchId?: string,
  ) {
    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        ...this.departmentWhere(),
        ...(expectedCompanyId ? { companyId: expectedCompanyId } : {}),
        ...(expectedBranchId ? { branchId: expectedBranchId } : {}),
      },
    });

    if (!department) {
      this.notFound('Department');
    }

    return department;
  }

  async assertBranchInScope(branchId: string, expectedCompanyId?: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        ...this.branchWhere(),
        ...(expectedCompanyId ? { companyId: expectedCompanyId } : {}),
      },
    });

    if (!branch) {
      this.notFound('Branch');
    }

    return branch;
  }

  async assertDesignationInScope(
    designationId: string,
    expectedCompanyId?: string,
  ) {
    const designation = await this.prisma.designation.findFirst({
      where: {
        id: designationId,
        ...this.designationWhere(),
        ...(expectedCompanyId ? { companyId: expectedCompanyId } : {}),
      },
    });

    if (!designation) {
      this.notFound('Designation');
    }

    return designation;
  }

  async assertAssetCategoryInScope(
    assetCategoryId: string,
    expectedCompanyId?: string,
  ) {
    const category = await this.prisma.assetCategory.findFirst({
      where: {
        id: assetCategoryId,
        ...this.assetCategoryWhere(),
        ...(expectedCompanyId ? { companyId: expectedCompanyId } : {}),
      },
    });

    if (!category) {
      this.notFound('Asset category');
    }

    return category;
  }

  async assertAssetTypeInScope(
    assetTypeId: string,
    expectedCompanyId?: string,
  ) {
    const assetType = await this.prisma.assetType.findFirst({
      where: {
        id: assetTypeId,
        ...this.assetTypeWhere(),
        ...(expectedCompanyId ? { companyId: expectedCompanyId } : {}),
      },
    });

    if (!assetType) {
      this.notFound('Asset type');
    }

    return assetType;
  }
}
