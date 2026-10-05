import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmployeeCreationSource,
  OrganizationOnboardingStatus,
  OrganizationOnboardingStep,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrganizationScopeService } from '../auth';
import { NumberSeriesService } from '../number-series';
import { OwnerEmployeeSelectionDto } from './dto/owner-employee-selection.dto';
import { splitOwnerDisplayName } from './owner-founding-employee';

const EDITABLE_STEPS = new Set<OrganizationOnboardingStep>([
  OrganizationOnboardingStep.ORGANIZATION,
  OrganizationOnboardingStep.COMPANY,
  OrganizationOnboardingStep.BRANCH,
  OrganizationOnboardingStep.STRUCTURE,
  OrganizationOnboardingStep.TEAM,
  OrganizationOnboardingStep.REVIEW,
]);

@Injectable()
export class OrganizationOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly numberSeries: NumberSeriesService,
    private readonly auditService: AuditService,
  ) {}

  async getStatus(userId: string) {
    const companyGroupId = this.requireCompanyGroup();
    const onboarding = await this.loadOrCreateExistingTenantStatus(
      companyGroupId,
      userId,
    );

    if (onboarding.status === OrganizationOnboardingStatus.IN_PROGRESS) {
      await this.syncResumeStep(companyGroupId, onboarding);
    }

    const summary = await this.loadSummary(companyGroupId);
    const ownerEmployee = await this.loadOwnerEmployee(
      onboarding.ownerUserId,
      companyGroupId,
    );
    const refreshed = await this.prisma.organizationOnboarding.findUnique({
      where: { companyGroupId },
    });

    return {
      ...(refreshed ?? onboarding),
      isOwner: onboarding.ownerUserId === userId,
      ownerEmployee,
      ownerEmployeeLink: this.buildOwnerEmployeeLink(
        refreshed?.status ?? onboarding.status,
        ownerEmployee,
        companyGroupId,
      ),
      ...summary,
    };
  }

  async repairOwnerEmployee(
    userId: string,
    selection: OwnerEmployeeSelectionDto,
  ) {
    const companyGroupId = this.requireCompanyGroup();
    const onboarding = await this.requireOwner(companyGroupId, userId);

    try {
      const employee = await this.ensureOwnerFoundingEmployee(
        companyGroupId,
        onboarding.ownerUserId,
        selection,
      );
      if (!employee) {
        throw new BadRequestException({
          message:
            'Owner employee link could not be created. Confirm the selected company, branch, department, and designation, then retry.',
          code: 'OWNER_EMPLOYEE_REPAIR_FAILED',
          supportCode: this.ownerEmployeeSupportCode(companyGroupId),
        });
      }
      return this.getStatus(userId);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException({
        message:
          'Owner employee link repair failed. Share the support code with an administrator if this continues.',
        code: 'OWNER_EMPLOYEE_REPAIR_FAILED',
        supportCode: this.ownerEmployeeSupportCode(companyGroupId),
      });
    }
  }

  async updateStep(userId: string, currentStep: OrganizationOnboardingStep) {
    const companyGroupId = this.requireCompanyGroup();
    const onboarding = await this.requireOwner(companyGroupId, userId);

    if (onboarding.status === OrganizationOnboardingStatus.COMPLETED) {
      return this.getStatus(userId);
    }

    if (!EDITABLE_STEPS.has(currentStep)) {
      throw new BadRequestException(
        'Use the completion action to finish organization onboarding.',
      );
    }

    await this.prisma.organizationOnboarding.update({
      where: { companyGroupId },
      data: { currentStep },
    });

    return this.getStatus(userId);
  }

  async complete(userId: string, selection: OwnerEmployeeSelectionDto) {
    const companyGroupId = this.requireCompanyGroup();
    const onboarding = await this.requireOwner(companyGroupId, userId);

    if (onboarding.status === OrganizationOnboardingStatus.COMPLETED) {
      await this.ensureOwnerFoundingEmployee(companyGroupId, userId, selection);
      return this.getStatus(userId);
    }

    const summary = await this.loadSummary(companyGroupId);
    const missing: string[] = [];

    if (!summary.company) {
      missing.push('company');
    }
    if (summary.counts.branches < 1) {
      missing.push('branch');
    }
    if (summary.counts.departments < 1) {
      missing.push('department');
    }
    if (summary.counts.designations < 1) {
      missing.push('designation');
    }

    if (missing.length > 0) {
      throw new BadRequestException({
        message: 'Complete the required organization setup before continuing.',
        missing,
      });
    }

    // Create founding employee before marking COMPLETED so a unique conflict
    // does not leave the wizard stuck with a completed flag and a failed link.
    await this.ensureOwnerFoundingEmployee(companyGroupId, userId, selection);

    await this.prisma.organizationOnboarding.update({
      where: { companyGroupId },
      data: {
        status: OrganizationOnboardingStatus.COMPLETED,
        currentStep: OrganizationOnboardingStep.COMPLETED,
        completedAt: new Date(),
      },
    });

    return this.getStatus(userId);
  }

  private requireCompanyGroup(): string {
    const scope = this.organizationScope.current();

    if (scope.isGlobal || !scope.activeCompanyGroupId) {
      throw new ForbiddenException(
        'Select a Company Group to access organization onboarding.',
      );
    }

    return scope.activeCompanyGroupId;
  }

  private async requireOwner(companyGroupId: string, userId: string) {
    const onboarding = await this.prisma.organizationOnboarding.findUnique({
      where: { companyGroupId },
    });

    if (!onboarding || onboarding.ownerUserId !== userId) {
      throw new ForbiddenException(
        'Only the Organization Owner can complete this onboarding.',
      );
    }

    return onboarding;
  }

  private async loadOrCreateExistingTenantStatus(
    companyGroupId: string,
    userId: string,
  ) {
    const existing = await this.prisma.organizationOnboarding.findUnique({
      where: { companyGroupId },
    });

    if (existing) {
      return existing;
    }

    const ownerAssignment = await this.prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        companyGroupId,
        isActive: true,
        role: {
          code: 'ORGANIZATION_OWNER',
          isActive: true,
        },
      },
      select: { id: true },
    });

    if (!ownerAssignment) {
      throw new NotFoundException('Organization onboarding was not found.');
    }

    return this.prisma.organizationOnboarding.upsert({
      where: { companyGroupId },
      update: {},
      create: {
        companyGroupId,
        ownerUserId: userId,
        status: OrganizationOnboardingStatus.COMPLETED,
        currentStep: OrganizationOnboardingStep.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  private async loadOwnerEmployee(ownerUserId: string, companyGroupId: string) {
    return this.prisma.employee.findFirst({
      where: {
        isActive: true,
        company: {
          companyGroupId,
          isActive: true,
        },
        user: {
          is: { id: ownerUserId },
        },
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        creationSource: true,
      },
    });
  }

  private ownerEmployeeSupportCode(companyGroupId: string): string {
    const compact = companyGroupId.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `OES-${compact}`;
  }

  private buildOwnerEmployeeLink(
    status: OrganizationOnboardingStatus,
    ownerEmployee: { id: string } | null,
    companyGroupId: string,
  ) {
    if (ownerEmployee) {
      return {
        state: 'LINKED' as const,
        supportCode: null as string | null,
      };
    }
    if (status === OrganizationOnboardingStatus.IN_PROGRESS) {
      return {
        state: 'AWAITING_SETUP' as const,
        supportCode: null as string | null,
      };
    }
    return {
      state: 'NEEDS_REPAIR' as const,
      supportCode: this.ownerEmployeeSupportCode(companyGroupId),
    };
  }

  private async syncResumeStep(
    companyGroupId: string,
    onboarding: {
      currentStep: OrganizationOnboardingStep;
      status: OrganizationOnboardingStatus;
    },
  ) {
    const summary = await this.loadSummary(companyGroupId);
    let nextStep: OrganizationOnboardingStep =
      OrganizationOnboardingStep.ORGANIZATION;
    if (!summary.requirements.company) {
      nextStep = OrganizationOnboardingStep.COMPANY;
    } else if (!summary.requirements.branch) {
      nextStep = OrganizationOnboardingStep.BRANCH;
    } else if (!summary.requirements.department) {
      nextStep = OrganizationOnboardingStep.STRUCTURE;
    } else if (!summary.requirements.designation) {
      nextStep = OrganizationOnboardingStep.TEAM;
    } else {
      nextStep = OrganizationOnboardingStep.REVIEW;
    }

    if (onboarding.currentStep !== nextStep) {
      await this.prisma.organizationOnboarding.update({
        where: { companyGroupId },
        data: { currentStep: nextStep },
      });
    }
  }

  /**
   * Creates the Organization Owner as the first Employee for a completed tenant.
   * Idempotent. Does not use recruitment conversion or a bulk-import source.
   */
  async ensureOwnerFoundingEmployee(
    companyGroupId: string,
    ownerUserId: string,
    selection: OwnerEmployeeSelectionDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
      },
    });

    if (!user) {
      return null;
    }

    const { firstName, lastName } = splitOwnerDisplayName(
      user.displayName,
      user.username,
    );

    // Shared DBs can leave number_series behind max(employee_code). Retry on
    // unique conflicts so Finish setup does not stick on EMP-###### collisions.
    const maxAttempts = 8;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          await this.validateOwnerEmployeeSelection(
            tx,
            companyGroupId,
            selection,
          );

          const freshUser = await tx.user.findUnique({
            where: { id: user.id },
            select: { employeeId: true },
          });
          if (freshUser?.employeeId) {
            const linked = await tx.employee.findUnique({
              where: { id: freshUser.employeeId },
              select: {
                id: true,
                employeeCode: true,
                companyId: true,
                branchId: true,
                departmentId: true,
                designationId: true,
              },
            });
            if (linked) {
              this.assertEmployeeMatchesSelection(linked, selection);
              await tx.user.update({
                where: { id: user.id },
                data: {
                  defaultCompanyGroupId: companyGroupId,
                  defaultCompanyId: selection.companyId,
                  defaultBranchId: selection.branchId,
                },
              });
              return linked;
            }
          }

          if (user.email) {
            const byEmail = await tx.employee.findFirst({
              where: {
                companyId: selection.companyId,
                email: user.email,
                isActive: true,
              },
              select: {
                id: true,
                employeeCode: true,
                companyId: true,
                branchId: true,
                departmentId: true,
                designationId: true,
              },
            });
            if (byEmail) {
              this.assertEmployeeMatchesSelection(byEmail, selection);
              await tx.user.update({
                where: { id: user.id },
                data: {
                  employeeId: byEmail.id,
                  defaultCompanyGroupId: companyGroupId,
                  defaultCompanyId: selection.companyId,
                  defaultBranchId: selection.branchId,
                },
              });
              return byEmail;
            }
          }

          const employeeCode = await this.numberSeries.next(
            'EMPLOYEE',
            'GLOBAL',
            'EMP',
            6,
            tx,
          );

          const employee = await tx.employee.create({
            data: {
              employeeCode,
              companyId: selection.companyId,
              branchId: selection.branchId,
              departmentId: selection.departmentId,
              designationId: selection.designationId,
              firstName,
              lastName,
              email: user.email,
              joiningDate: new Date(),
              employeeType: 'PERMANENT',
              employmentStatus: 'ACTIVE',
              creationSource: EmployeeCreationSource.ORGANIZATION_SETUP,
              isActive: true,
            },
          });

          await tx.user.update({
            where: { id: user.id },
            data: {
              employeeId: employee.id,
              defaultCompanyGroupId: companyGroupId,
              defaultCompanyId: selection.companyId,
              defaultBranchId: selection.branchId,
            },
          });

          await this.auditService.log(
            'Employee',
            employee.id,
            'CREATE',
            null,
            {
              id: employee.id,
              employeeCode: employee.employeeCode,
              creationSource: employee.creationSource,
            },
            { userId: ownerUserId, tx },
          );

          return {
            id: employee.id,
            employeeCode: employee.employeeCode,
          };
        });
      } catch (error) {
        lastError = error;
        const isUniqueConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002';
        if (!isUniqueConflict || attempt === maxAttempts) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  private async validateOwnerEmployeeSelection(
    tx: Prisma.TransactionClient,
    companyGroupId: string,
    selection: OwnerEmployeeSelectionDto,
  ) {
    const company = await tx.company.findFirst({
      where: {
        id: selection.companyId,
        companyGroupId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!company) {
      this.throwInvalidOwnerSelection('companyId');
    }

    const [branch, department, designation] = await Promise.all([
      tx.branch.findFirst({
        where: {
          id: selection.branchId,
          companyId: selection.companyId,
          isActive: true,
        },
        select: { id: true },
      }),
      tx.department.findFirst({
        where: {
          id: selection.departmentId,
          companyId: selection.companyId,
          branchId: selection.branchId,
          isActive: true,
        },
        select: { id: true },
      }),
      tx.designation.findFirst({
        where: {
          id: selection.designationId,
          companyId: selection.companyId,
          isActive: true,
        },
        select: { id: true, departmentId: true },
      }),
    ]);

    if (!branch) {
      this.throwInvalidOwnerSelection('branchId');
    }
    if (!department) {
      this.throwInvalidOwnerSelection('departmentId');
    }
    if (
      !designation ||
      (designation.departmentId &&
        designation.departmentId !== selection.departmentId)
    ) {
      this.throwInvalidOwnerSelection('designationId');
    }
  }

  private assertEmployeeMatchesSelection(
    employee: {
      companyId: string;
      branchId: string;
      departmentId: string;
      designationId: string | null;
    },
    selection: OwnerEmployeeSelectionDto,
  ) {
    if (
      employee.companyId !== selection.companyId ||
      employee.branchId !== selection.branchId ||
      employee.departmentId !== selection.departmentId ||
      employee.designationId !== selection.designationId
    ) {
      throw new BadRequestException({
        message:
          'The owner is already associated with a different Company, Branch, Department, or Designation.',
        code: 'OWNER_EMPLOYEE_SELECTION_CONFLICT',
      });
    }
  }

  private throwInvalidOwnerSelection(field: keyof OwnerEmployeeSelectionDto) {
    throw new BadRequestException({
      message:
        'Select an active Company, Branch, Department, and Designation from the same organization.',
      code: 'OWNER_EMPLOYEE_SELECTION_INVALID',
      field,
    });
  }

  private async loadSummary(companyGroupId: string) {
    const [companyGroup, company, branches, departments, designations, shifts] =
      // This is a read-only status projection. A batch transaction provides no
      // stronger snapshot guarantee at PostgreSQL's default isolation level,
      // but can expire under shared-RDS contention (P2028) and block every
      // Organization Owner dashboard route behind the onboarding gate.
      await Promise.all([
        this.prisma.companyGroup.findUnique({
          where: { id: companyGroupId },
          select: {
            id: true,
            groupCode: true,
            groupName: true,
            description: true,
          },
        }),
        this.prisma.company.findFirst({
          where: { companyGroupId, isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            companyCode: true,
            companyName: true,
            legalCountryCode: true,
            registrationNo: true,
            taxNumber: true,
          },
        }),
        this.prisma.branch.count({
          where: { isActive: true, company: { companyGroupId } },
        }),
        this.prisma.department.count({
          where: { isActive: true, company: { companyGroupId } },
        }),
        this.prisma.designation.count({
          where: { isActive: true, company: { companyGroupId } },
        }),
        this.prisma.shift.count({
          where: { isActive: true, company: { companyGroupId } },
        }),
      ]);

    if (!companyGroup) {
      throw new NotFoundException('Company Group not found.');
    }

    return {
      companyGroup,
      company,
      counts: {
        branches,
        departments,
        designations,
        shifts,
      },
      requirements: {
        company: Boolean(company),
        branch: branches > 0,
        department: departments > 0,
        designation: designations > 0,
      },
    };
  }
}
