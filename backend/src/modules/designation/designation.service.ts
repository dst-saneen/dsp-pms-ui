import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OrganizationScopeService } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { NumberSeriesService } from '../number-series';
import { OnboardingFeatureGateService } from '../onboarding-runtime/services/onboarding-feature-gate.service';
import { ONBOARDING_PERMISSIONS } from '../onboarding-runtime/constants/onboarding-permissions';

import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';

type Tx = Prisma.TransactionClient;

@Injectable()
export class DesignationService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly scope: EmployeeDomainScopeService,
    private readonly numberSeries: NumberSeriesService,
    private readonly onboardingFeatureGate: OnboardingFeatureGateService,
  ) {}

  async create(dto: CreateDesignationDto, actor?: AuthenticatedUser) {
    await this.organizationScope.assertCurrentCompany(dto.companyId);
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const departmentIds = [
      ...new Set((dto.onboardingDepartmentIds ?? []).filter(Boolean)),
    ];
    const wantsOnboardingLink = departmentIds.length > 0;
    const isActive = dto.isActive ?? true;

    if (wantsOnboardingLink) {
      this.assertCanLinkOnboarding(actor);
      if (!isActive) {
        throw new ConflictException(
          'Cannot link onboarding departments while the Designation is inactive. Create as active, or activate first.',
        );
      }
      if (!dto.branchId) {
        throw new ConflictException(
          'branchId is required when linking onboarding departments.',
        );
      }
      await this.organizationScope.assertCurrentBranch(dto.branchId);
      await this.assertOnboardingEnabled(dto.companyId, dto.branchId);
    }

    const homeDepartmentId =
      dto.departmentId === undefined ? null : dto.departmentId;
    if (homeDepartmentId) {
      await this.assertHomeDepartment(homeDepartmentId, dto.companyId);
    }

    const designationCode = await this.numberSeries.next(
      'DESIGNATION',
      dto.companyId,
      'DES',
    );

    const designation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.designation.create({
        data: {
          companyId: dto.companyId,
          designationName: dto.designationName,
          level: dto.level,
          isActive,
          designationCode,
          departmentId: homeDepartmentId,
        },
      });

      if (wantsOnboardingLink && dto.branchId) {
        for (const departmentId of departmentIds) {
          await this.linkDepartmentInTransaction(
            tx,
            created.id,
            departmentId,
            dto.branchId,
          );
        }
      }

      return created;
    });

    await this.auditService.log('Designation', designation.id, 'CREATE', null, {
      ...designation,
      ...(dto.operationId ? { operationId: dto.operationId } : {}),
      ...(wantsOnboardingLink
        ? {
            onboardingBranchId: dto.branchId,
            onboardingDepartmentIds: departmentIds,
          }
        : {}),
    });

    return this.findOne(designation.id);
  }

  async addDepartment(
    designationId: string,
    departmentId: string,
    branchId?: string,
    actor?: AuthenticatedUser,
  ) {
    this.assertCanLinkOnboarding(actor);
    const scopedDesignation = await this.findOne(designationId);

    if (!scopedDesignation.isActive) {
      throw new ConflictException(
        'Cannot link onboarding departments to an inactive Designation. Activate it first.',
      );
    }

    const scopedDepartment = await this.scope.assertDepartmentInScope(
      departmentId,
      scopedDesignation.companyId,
    );

    if (branchId && scopedDepartment.branchId !== branchId) {
      throw new ConflictException(
        'Selected department does not belong to the specified Branch.',
      );
    }

    const resolvedBranchId = branchId ?? scopedDepartment.branchId;
    await this.assertOnboardingEnabled(
      scopedDesignation.companyId,
      resolvedBranchId,
    );

    return this.prisma.$transaction(async (tx) =>
      this.linkDepartmentInTransaction(
        tx,
        designationId,
        departmentId,
        resolvedBranchId,
      ),
    );
  }

  async findAll(companyId?: string) {
    if (companyId) {
      await this.organizationScope.assertCurrentCompany(companyId);
    }

    return this.prisma.designation.findMany({
      where: {
        ...this.scope.designationWhere(),
        ...(companyId ? { companyId } : {}),
      },
      include: {
        company: true,
        ...this.homeDepartmentInclude(),
        ...this.onboardingDepartmentsInclude(),
      },
      orderBy: {
        designationName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const designation = await this.prisma.designation.findFirst({
      where: {
        id,
        ...this.scope.designationWhere(),
      },
      include: {
        company: true,
        ...this.homeDepartmentInclude(),
        ...this.onboardingDepartmentsInclude(),
      },
    });

    if (!designation) {
      throw new NotFoundException('Designation not found');
    }

    return designation;
  }

  async update(
    id: string,
    dto: UpdateDesignationDto,
    actor?: AuthenticatedUser,
  ) {
    const oldValue = await this.findOne(id);

    if (dto.departmentId) {
      await this.assertHomeDepartment(dto.departmentId, oldValue.companyId);
    }

    const syncOnboarding = dto.onboardingDepartmentIds !== undefined;
    const desiredDepartmentIds = syncOnboarding
      ? [...new Set((dto.onboardingDepartmentIds ?? []).filter(Boolean))]
      : null;
    const wantsOnboardingLink =
      desiredDepartmentIds !== null && desiredDepartmentIds.length > 0;
    const nextIsActive = dto.isActive ?? oldValue.isActive;

    if (syncOnboarding) {
      this.assertCanLinkOnboarding(actor);
      if (wantsOnboardingLink) {
        if (!nextIsActive) {
          throw new ConflictException(
            'Cannot link onboarding departments while the Designation is inactive. Keep it active, or clear departments first.',
          );
        }
        if (!dto.branchId) {
          throw new ConflictException(
            'branchId is required when linking onboarding departments.',
          );
        }
        await this.organizationScope.assertCurrentBranch(dto.branchId);
        await this.assertOnboardingEnabled(oldValue.companyId, dto.branchId);
      }
    }

    const designation = await this.prisma.$transaction(async (tx) => {
      const coreData: Prisma.DesignationUncheckedUpdateInput = {};
      if (dto.designationName !== undefined) {
        coreData.designationName = dto.designationName;
      }
      if (dto.level !== undefined) {
        coreData.level = dto.level;
      }
      if (dto.departmentId !== undefined) {
        coreData.departmentId = dto.departmentId;
      }
      // Keep / make active before linking; deactivate after unlink if needed.
      if (nextIsActive) {
        coreData.isActive = true;
      } else if (!syncOnboarding) {
        if (dto.isActive !== undefined) {
          coreData.isActive = false;
        }
      }

      if (Object.keys(coreData).length > 0) {
        await tx.designation.update({
          where: { id },
          data: coreData,
        });
      }

      if (desiredDepartmentIds !== null) {
        const currentLinks = await this.getCurrentDepartmentLinks(tx, id);
        const currentIds = new Set(
          currentLinks.map((link) => link.departmentId),
        );
        const desiredSet = new Set(desiredDepartmentIds);
        const toRemove = currentLinks.filter(
          (link) => !desiredSet.has(link.departmentId),
        );
        const toAdd = desiredDepartmentIds.filter(
          (departmentId) => !currentIds.has(departmentId),
        );

        if (toRemove.length > 0 || toAdd.length > 0) {
          await this.assertCurrentVersionMutableForSync(tx, id);
        }

        for (const link of toRemove) {
          await this.unlinkDepartmentInTransaction(tx, link.id);
        }

        if (toAdd.length > 0 && dto.branchId) {
          for (const departmentId of toAdd) {
            await this.linkDepartmentInTransaction(
              tx,
              id,
              departmentId,
              dto.branchId,
            );
          }
        }
      }

      if (!nextIsActive && syncOnboarding) {
        await tx.designation.update({
          where: { id },
          data: { isActive: false },
        });
      }

      return tx.designation.findUniqueOrThrow({ where: { id } });
    });

    await this.auditService.log('Designation', id, 'UPDATE', oldValue, {
      ...designation,
      ...(dto.operationId ? { operationId: dto.operationId } : {}),
      ...(syncOnboarding
        ? {
            onboardingBranchId: dto.branchId ?? null,
            onboardingDepartmentIds: desiredDepartmentIds,
          }
        : {}),
    });

    return this.findOne(id);
  }

  async getOnboardingWorkspace(companyId?: string) {
    return this.prisma.designation.findMany({
      where: {
        AND: [
          this.scope.designationWhere(),
          ...(companyId ? [{ companyId }] : []),
          {
            OR: [
              { isActive: true },
              {
                isActive: false,
                onboardingTemplateId: { not: null },
              },
            ],
          },
        ],
      },
      orderBy: [{ isActive: 'desc' }, { designationName: 'asc' }],
      include: {
        onboardingTemplate: {
          include: {
            versions: {
              where: {
                isCurrent: true,
              },
              include: {
                departments: {
                  include: {
                    department: true,
                    taskGroups: {
                      include: {
                        tasks: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string) {
    const oldValue = await this.findOne(id);

    await this.auditService.log('Designation', id, 'DELETE', oldValue, null);

    return this.prisma.designation.delete({
      where: { id },
    });
  }

  private assertCanLinkOnboarding(actor?: AuthenticatedUser): void {
    if (!actor) {
      return;
    }
    const permissions = actor.authorization?.permissions ?? [];
    if (
      actor.authorization?.isGlobal ||
      permissions.includes('platform.admin') ||
      permissions.includes(ONBOARDING_PERMISSIONS.MANAGE)
    ) {
      return;
    }
    throw new ForbiddenException({
      code: 'ONBOARDING_PERMISSION_REQUIRED',
      message:
        'hr.onboarding.manage is required to link onboarding departments to a Designation.',
    });
  }

  private async assertOnboardingEnabled(
    companyId: string,
    branchId?: string,
  ): Promise<void> {
    if (
      !(await this.onboardingFeatureGate.isEnabledForContext(
        companyId,
        branchId,
      ))
    ) {
      throw new ForbiddenException({
        code: 'ONBOARDING_MODULE_NOT_ENABLED',
        message: 'Onboarding is not enabled for this Company/Branch scope.',
      });
    }
  }

  private async linkDepartmentInTransaction(
    tx: Tx,
    designationId: string,
    departmentId: string,
    expectedBranchId: string,
  ) {
    const designation = await tx.designation.findFirst({
      where: { id: designationId },
    });

    if (!designation) {
      throw new NotFoundException('Designation not found');
    }

    if (!designation.isActive) {
      throw new ConflictException(
        'Cannot link onboarding departments to an inactive Designation.',
      );
    }

    const department = await tx.department.findFirst({
      where: {
        id: departmentId,
        companyId: designation.companyId,
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (department.branchId !== expectedBranchId) {
      throw new ConflictException(
        'Selected department does not belong to the specified Branch.',
      );
    }

    await this.assertOnboardingEnabled(designation.companyId, expectedBranchId);

    let template = designation.onboardingTemplateId
      ? await tx.onboardingTemplate.findFirst({
          where: {
            id: designation.onboardingTemplateId,
            companyId: designation.companyId,
          },
        })
      : null;

    if (designation.onboardingTemplateId && !template) {
      throw new NotFoundException('Onboarding template not found');
    }

    if (!template) {
      template = await tx.onboardingTemplate.create({
        data: {
          companyId: designation.companyId,
          templateCode: designation.designationCode,
          templateName: designation.designationName,
        },
      });

      await tx.designation.update({
        where: { id: designation.id },
        data: { onboardingTemplateId: template.id },
      });
    }

    let version = await tx.onboardingTemplateVersion.findFirst({
      where: {
        onboardingTemplateId: template.id,
        companyId: designation.companyId,
        isCurrent: true,
      },
    });

    if (!version) {
      const existingVersion = await tx.onboardingTemplateVersion.findFirst({
        where: {
          onboardingTemplateId: template.id,
          companyId: designation.companyId,
        },
        orderBy: { versionNo: 'desc' },
      });

      if (existingVersion) {
        throw new ConflictException(
          'Create a draft template version before adding a department.',
        );
      }

      version = await tx.onboardingTemplateVersion.create({
        data: {
          onboardingTemplateId: template.id,
          companyId: designation.companyId,
          versionNo: 1,
          versionName: 'Version 1',
          status: 'DRAFT',
          isCurrent: true,
          rowVersion: 1,
        },
      });
    } else if (version.status !== 'DRAFT') {
      throw new ConflictException(
        'Create a draft template version before adding a department.',
      );
    }

    const existingScope = await tx.onboardingTemplateScope.findFirst({
      where: {
        onboardingTemplateVersionId: version.id,
        designationId: designation.id,
        branchId: expectedBranchId,
        isActive: true,
      },
    });
    if (!existingScope) {
      await tx.onboardingTemplateScope.create({
        data: {
          onboardingTemplateVersionId: version.id,
          companyId: designation.companyId,
          branchId: expectedBranchId,
          designationId: designation.id,
          priority: 100,
          isActive: true,
          description: `Applies to ${designation.designationName}`,
        },
      });
    }

    const branchMismatch = await tx.onboardingDepartmentTemplate.findFirst({
      where: {
        onboardingTemplateVersionId: version.id,
        department: {
          branchId: { not: expectedBranchId },
        },
      },
      select: { id: true },
    });

    if (branchMismatch) {
      throw new ConflictException(
        'Department work in a template version must belong to one Branch.',
      );
    }

    const existing = await tx.onboardingDepartmentTemplate.findFirst({
      where: {
        onboardingTemplateVersionId: version.id,
        departmentId,
      },
    });

    if (existing) {
      return existing;
    }

    return tx.onboardingDepartmentTemplate.create({
      data: {
        companyId: designation.companyId,
        branchId: expectedBranchId,
        onboardingTemplateVersionId: version.id,
        departmentId,
        rowVersion: 1,
      },
    });
  }

  private async getCurrentDepartmentLinks(tx: Tx, designationId: string) {
    const designation = await tx.designation.findFirst({
      where: { id: designationId },
      select: {
        id: true,
        onboardingTemplateId: true,
        companyId: true,
      },
    });

    if (!designation?.onboardingTemplateId) {
      return [] as Array<{ id: string; departmentId: string }>;
    }

    const version = await tx.onboardingTemplateVersion.findFirst({
      where: {
        onboardingTemplateId: designation.onboardingTemplateId,
        companyId: designation.companyId,
        isCurrent: true,
      },
      select: {
        id: true,
        departments: {
          select: {
            id: true,
            departmentId: true,
          },
        },
      },
    });

    if (version) {
      await this.assertExclusiveTemplateOwnershipForDepartmentSync(
        tx,
        designation.id,
        designation.companyId,
        designation.onboardingTemplateId,
        version.id,
      );
    }

    return version?.departments ?? [];
  }

  /**
   * Department slices are owned by an onboarding template version, not by a
   * Designation. The direct Designation template field is a retired compatibility fallback;
   * the canonical DesignationOnboardingAssignment and template scopes can
   * also point at the same template. Do not infer per-Designation ownership
   * from a shared template: a remove sync would otherwise delete another
   * Designation's task groups and tasks.
   */
  private async assertExclusiveTemplateOwnershipForDepartmentSync(
    tx: Tx,
    designationId: string,
    companyId: string,
    onboardingTemplateId: string,
    onboardingTemplateVersionId: string,
  ): Promise<void> {
    const [legacyDesignation, assignment, scope] = await Promise.all([
      tx.designation.findFirst({
        where: {
          companyId,
          onboardingTemplateId,
          id: { not: designationId },
        },
        select: { id: true },
      }),
      tx.designationOnboardingAssignment.findFirst({
        where: {
          onboardingTemplateId,
          designationId: { not: designationId },
        },
        select: { id: true },
      }),
      tx.onboardingTemplateScope.findFirst({
        where: {
          onboardingTemplateVersionId,
          OR: [
            { designationId: null },
            { designationId: { not: designationId } },
          ],
        },
        select: { id: true },
      }),
    ]);

    if (legacyDesignation || assignment || scope) {
      throw new ConflictException(
        'Cannot synchronize onboarding departments for a shared or ambiguously owned template. Use a designation-specific template before changing its departments.',
      );
    }
  }

  private async assertCurrentVersionMutableForSync(
    tx: Tx,
    designationId: string,
  ) {
    const designation = await tx.designation.findFirst({
      where: { id: designationId },
      select: {
        onboardingTemplateId: true,
        companyId: true,
      },
    });

    if (!designation?.onboardingTemplateId) {
      return;
    }

    const version = await tx.onboardingTemplateVersion.findFirst({
      where: {
        onboardingTemplateId: designation.onboardingTemplateId,
        companyId: designation.companyId,
        isCurrent: true,
      },
      select: { status: true },
    });

    if (version && version.status !== 'DRAFT') {
      throw new ConflictException(
        'Create a draft template version before changing onboarding departments.',
      );
    }
  }

  private async unlinkDepartmentInTransaction(
    tx: Tx,
    departmentTemplateId: string,
  ) {
    const groups = await tx.onboardingTaskGroup.findMany({
      where: { onboardingDepartmentTemplateId: departmentTemplateId },
      select: { id: true },
    });
    const groupIds = groups.map((group) => group.id);
    if (groupIds.length > 0) {
      await tx.onboardingTemplateTask.deleteMany({
        where: { taskGroupId: { in: groupIds } },
      });
      await tx.onboardingTaskGroup.deleteMany({
        where: { id: { in: groupIds } },
      });
    }
    await tx.onboardingDepartmentTemplate.delete({
      where: { id: departmentTemplateId },
    });
  }

  private async assertHomeDepartment(departmentId: string, companyId: string) {
    const department = await this.scope.assertDepartmentInScope(
      departmentId,
      companyId,
    );
    if (department.companyId !== companyId) {
      throw new ConflictException(
        'Home Department must belong to the same Company as the Designation.',
      );
    }
    return department;
  }

  private homeDepartmentInclude() {
    return {
      department: {
        select: {
          id: true,
          departmentCode: true,
          departmentName: true,
          branchId: true,
          branch: {
            select: {
              id: true,
              branchCode: true,
              branchName: true,
            },
          },
        },
      },
    };
  }

  private onboardingDepartmentsInclude() {
    return {
      onboardingTemplate: {
        select: {
          id: true,
          versions: {
            where: { isCurrent: true },
            take: 1,
            select: {
              id: true,
              status: true,
              departments: {
                select: {
                  id: true,
                  departmentId: true,
                  rowVersion: true,
                  department: {
                    select: {
                      id: true,
                      departmentCode: true,
                      departmentName: true,
                      branchId: true,
                    },
                  },
                },
                orderBy: {
                  department: {
                    departmentName: 'asc' as const,
                  },
                },
              },
            },
          },
        },
      },
    };
  }
}
