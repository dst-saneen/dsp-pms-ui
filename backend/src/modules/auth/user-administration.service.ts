import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  RoleScope,
  SecurityEventType,
  UserStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { getRequestId } from '../../common';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUser, RequestSecurityMetadata } from './auth.types';
import { AccountLifecycleService } from './account-lifecycle.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRoleAssignmentDto } from './dto/user-role-assignment.dto';
import { OrganizationScopeService } from './organization-scope.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Injectable()
export class UserAdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly accountLifecycle: AccountLifecycleService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreateUserDto,
    metadata: RequestSecurityMetadata,
  ) {
    const email = dto.email.trim();
    const normalizedEmail = this.normalize(email);
    const username =
      dto.username?.trim() ??
      this.generateUsername(dto.displayName?.trim(), normalizedEmail);
    const normalizedUsername = this.normalize(username);
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ normalizedUsername }, { normalizedEmail }],
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'A user with this username or email already exists.',
      );
    }

    await this.validateAssignments(actor, dto.roleAssignments);
    await this.validateDefaults(
      actor,
      dto.defaultCompanyGroupId,
      dto.defaultCompanyId,
      dto.defaultBranchId,
    );
    await this.validateEmployee(actor, dto.employeeId);
    await this.validateDefaultAssignments(
      dto.roleAssignments,
      dto.defaultCompanyGroupId,
      dto.defaultCompanyId,
      dto.defaultBranchId,
    );

    const invitationCompanyGroupId = await this.resolveInvitationCompanyGroup(
      actor,
      dto.defaultCompanyGroupId,
      dto.defaultCompanyId,
    );
    const preparedInvitation = this.accountLifecycle.prepareInvitation();
    const assignments = dto.roleAssignments.map((assignment) =>
      this.toAssignmentData(assignment),
    );
    const user = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          username,
          normalizedUsername,
          displayName: dto.displayName?.trim(),
          email,
          normalizedEmail,
          passwordHash: null,
          status: UserStatus.INVITED,
          employeeId: dto.employeeId,
          defaultCompanyGroupId: dto.defaultCompanyGroupId,
          defaultCompanyId: dto.defaultCompanyId,
          defaultBranchId: dto.defaultBranchId,
          mustChangePassword: false,
        },
      });

      await transaction.userRoleAssignment.createMany({
        data: assignments.map((assignment) => ({
          ...assignment,
          userId: created.id,
        })),
      });

      const invitation = await transaction.userInvitation.create({
        data: {
          userId: created.id,
          companyGroupId: invitationCompanyGroupId,
          invitedByUserId: actor.id,
          email,
          normalizedEmail,
          tokenHash: preparedInvitation.tokenHash,
          expiresAt: preparedInvitation.expiresAt,
          resendAvailableAt: preparedInvitation.resendAvailableAt,
          ipHash: this.passwordService.hashMetadata(metadata.ip),
          userAgentHash: this.passwordService.hashMetadata(metadata.userAgent),
        },
      });

      await transaction.securityEvent.create({
        data: {
          userId: created.id,
          type: 'USER_INVITED',
          requestId: getRequestId(),
          ipHash: this.passwordService.hashMetadata(metadata.ip),
          metadata: {
            invitationId: invitation.id,
            invitedByUserId: actor.id,
          },
        },
      });

      return { created, invitation };
    });

    const delivery = await this.accountLifecycle.deliverInvitation({
      invitationId: user.invitation.id,
      email,
      displayName: user.created.displayName ?? user.created.username,
      token: preparedInvitation.token,
      expiresAt: preparedInvitation.expiresAt,
      resendAvailableAt: preparedInvitation.resendAvailableAt,
    });

    return {
      user: this.safeUser(user.created),
      invitation: delivery,
    };
  }

  async findAll(actor: AuthenticatedUser) {
    const groupId = actor.authorization.activeCompanyGroupId;
    const groupAssignmentWhere = groupId
      ? this.assignmentWithinCompanyGroup(groupId)
      : undefined;
    const where: Prisma.UserWhereInput = actor.authorization.isGlobal
      ? {}
      : groupAssignmentWhere &&
          actor.authorization.scopeLevel === RoleScope.COMPANY_GROUP
        ? {
            AND: [
              {
                roleAssignments: {
                  some: groupAssignmentWhere,
                },
              },
              {
                roleAssignments: {
                  none: {
                    isActive: true,
                    NOT: groupAssignmentWhere,
                  },
                },
              },
            ],
          }
        : actor.authorization.activeCompanyId
          ? {
              AND: [
                {
                  roleAssignments: {
                    some: this.assignmentWithinCompany(
                      actor.authorization.activeCompanyId,
                      actor.authorization.scopeLevel === RoleScope.BRANCH
                        ? actor.authorization.activeBranchId
                        : undefined,
                    ),
                  },
                },
                {
                  roleAssignments: {
                    none: {
                      isActive: true,
                      NOT: this.assignmentWithinCompany(
                        actor.authorization.activeCompanyId,
                        actor.authorization.scopeLevel === RoleScope.BRANCH
                          ? actor.authorization.activeBranchId
                          : undefined,
                      ),
                    },
                  },
                },
              ],
            }
          : {
              roleAssignments: {
                some: {
                  id: '__no_visible_assignment__',
                },
              },
            };
    const visibleAssignmentWhere = actor.authorization.isGlobal
      ? { isActive: true }
      : groupAssignmentWhere &&
          actor.authorization.scopeLevel === RoleScope.COMPANY_GROUP
        ? groupAssignmentWhere
        : actor.authorization.activeCompanyId
          ? this.assignmentWithinCompany(
              actor.authorization.activeCompanyId,
              actor.authorization.scopeLevel === RoleScope.BRANCH
                ? actor.authorization.activeBranchId
                : undefined,
            )
          : { id: '__no_visible_assignment__' };

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        status: true,
        mustChangePassword: true,
        employeeId: true,
        lastLoginAt: true,
        createdAt: true,
        roleAssignments: {
          where: visibleAssignmentWhere,
          select: {
            id: true,
            scope: true,
            scopeKey: true,
            companyGroupId: true,
            companyId: true,
            branchId: true,
            role: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { username: 'asc' },
    });
  }

  getRoles(actor: AuthenticatedUser, includeInactive = false) {
    const excludedRoleCodes =
      actor.authorization.scopeLevel === RoleScope.COMPANY_GROUP
        ? ['SUPER_ADMINISTRATOR']
        : ['SUPER_ADMINISTRATOR', 'ORGANIZATION_OWNER'];

    return this.prisma.role.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(actor.authorization.isGlobal
          ? {}
          : {
              AND: [
                {
                  permissions: {
                    none: {
                      permission: {
                        code: 'platform.admin',
                      },
                    },
                  },
                },
                {
                  OR: [
                    {
                      isSystem: true,
                      code: { notIn: excludedRoleCodes },
                    },
                    {
                      isSystem: false,
                      companyGroupId:
                        actor.authorization.activeCompanyGroupId ??
                        '__no_company_group__',
                    },
                  ],
                },
              ],
            }),
      },
      include: {
        _count: {
          select: {
            assignments: {
              where: { isActive: true },
            },
          },
        },
        permissions: {
          select: {
            permission: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  getPermissions(actor: AuthenticatedUser) {
    return this.prisma.permission.findMany({
      where: {
        isTenantAssignable: true,
        ...(actor.authorization.isGlobal
          ? {}
          : { code: { in: actor.authorization.permissions } }),
      },
      orderBy: { code: 'asc' },
    });
  }

  async replaceAssignments(
    actor: AuthenticatedUser,
    userId: string,
    roleAssignments: UserRoleAssignmentDto[],
  ) {
    await this.assertTargetVisible(actor, userId);
    await this.validateAssignments(actor, roleAssignments);
    const targetDefaults = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        defaultCompanyGroupId: true,
        defaultCompanyId: true,
        defaultBranchId: true,
      },
    });

    if (!targetDefaults) {
      throw new NotFoundException('User not found.');
    }

    await this.validateDefaultAssignments(
      roleAssignments,
      targetDefaults.defaultCompanyGroupId ?? undefined,
      targetDefaults.defaultCompanyId ?? undefined,
      targetDefaults.defaultBranchId ?? undefined,
    );
    const assignments = roleAssignments.map((assignment) =>
      this.toAssignmentData(assignment),
    );
    const deleteWhere: Prisma.UserRoleAssignmentWhereInput = actor.authorization
      .isGlobal
      ? { userId }
      : actor.authorization.scopeLevel === RoleScope.COMPANY_GROUP &&
          actor.authorization.activeCompanyGroupId
        ? {
            userId,
            ...this.assignmentWithinCompanyGroup(
              actor.authorization.activeCompanyGroupId,
              false,
            ),
          }
        : actor.authorization.activeCompanyId
          ? {
              userId,
              ...this.assignmentWithinCompany(
                actor.authorization.activeCompanyId,
                actor.authorization.scopeLevel === RoleScope.BRANCH
                  ? actor.authorization.activeBranchId
                  : undefined,
                false,
              ),
            }
          : { userId, id: '__no_visible_assignment__' };

    const previousAssignments = await this.prisma.userRoleAssignment.findMany({
      where: deleteWhere,
      select: {
        roleId: true,
        scope: true,
        companyGroupId: true,
        companyId: true,
        branchId: true,
        role: { select: { code: true, name: true } },
      },
    });
    const beforeSnapshot = previousAssignments.map((assignment) => ({
      roleId: assignment.roleId,
      roleCode: assignment.role.code,
      roleName: assignment.role.name,
      scope: assignment.scope,
      companyGroupId: assignment.companyGroupId,
      companyId: assignment.companyId,
      branchId: assignment.branchId,
    }));
    const afterSnapshot = roleAssignments.map((assignment) => ({
      roleId: assignment.roleId,
      scope: assignment.scope,
      companyGroupId: assignment.companyGroupId ?? null,
      companyId: assignment.companyId ?? null,
      branchId: assignment.branchId ?? null,
    }));

    const sessionIds = await this.prisma.$transaction(async (transaction) => {
      await this.assertLastOrganizationOwnerProtected(
        transaction,
        userId,
        roleAssignments,
      );
      await transaction.userRoleAssignment.deleteMany({ where: deleteWhere });
      await transaction.userRoleAssignment.createMany({
        data: assignments.map((assignment) => ({ ...assignment, userId })),
      });
      await transaction.user.update({
        where: { id: userId },
        data: { securityVersion: { increment: 1 } },
      });
      await transaction.securityEvent.create({
        data: {
          userId,
          type: SecurityEventType.ROLE_CHANGED,
          requestId: getRequestId(),
          metadata: {
            action: 'ASSIGNMENTS_REPLACED',
            before: beforeSnapshot,
            after: afterSnapshot,
          },
        },
      });
      await this.auditService.log(
        'User',
        userId,
        'UPDATE',
        { action: 'ASSIGNMENTS_REPLACED', assignments: beforeSnapshot },
        {
          action: 'ASSIGNMENTS_REPLACED',
          assignmentCount: assignments.length,
          assignments: afterSnapshot,
          sessionsRevoked: true,
        },
        { userId: actor.id, tx: transaction },
      );
      return this.sessionService.revokeAllInTransaction(
        transaction,
        userId,
        'ROLE_ASSIGNMENTS_CHANGED',
      );
    });
    await this.sessionService.invalidateSessionIds(sessionIds);

    return this.assertTargetVisible(actor, userId);
  }

  async updateStatus(
    actor: AuthenticatedUser,
    userId: string,
    status: UserStatus,
  ) {
    await this.assertTargetVisible(actor, userId);

    if (actor.id === userId && status !== UserStatus.ACTIVE) {
      throw new BadRequestException(
        'You cannot lock or disable your own account.',
      );
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      if (status !== UserStatus.ACTIVE) {
        await this.assertLastOrganizationOwnerProtected(transaction, userId);
      }

      const updated = await transaction.user.update({
        where: { id: userId },
        data: {
          status,
          lockedUntil: status === UserStatus.LOCKED ? undefined : null,
          failedLoginAttempts: status === UserStatus.ACTIVE ? 0 : undefined,
          securityVersion: { increment: 1 },
        },
      });
      await transaction.securityEvent.create({
        data: {
          userId,
          type: SecurityEventType.USER_STATUS_CHANGED,
          requestId: getRequestId(),
          metadata: { status },
        },
      });
      const sessionIds = await this.sessionService.revokeAllInTransaction(
        transaction,
        userId,
        'ACCOUNT_STATUS_CHANGED',
      );
      return { updated, sessionIds };
    });
    await this.sessionService.invalidateSessionIds(result.sessionIds);

    return this.safeUser(result.updated);
  }

  async resetPassword(
    actor: AuthenticatedUser,
    userId: string,
    metadata: RequestSecurityMetadata,
  ) {
    const user = await this.assertTargetVisible(actor, userId);

    if (
      !user.email ||
      (user.status !== UserStatus.ACTIVE && user.status !== UserStatus.LOCKED)
    ) {
      throw new BadRequestException(
        'A password reset can be sent only to an active account with an email address.',
      );
    }

    return this.accountLifecycle.requestPasswordReset(user.email, metadata);
  }

  async resendInvitation(
    actor: AuthenticatedUser,
    userId: string,
    metadata: RequestSecurityMetadata,
  ) {
    await this.assertTargetVisible(actor, userId);
    return this.accountLifecycle.resendInvitation(userId, actor.id, metadata);
  }

  async listSessions(actor: AuthenticatedUser, userId: string) {
    await this.assertTargetVisible(actor, userId);
    return this.sessionService.list(userId);
  }

  async revokeSession(
    actor: AuthenticatedUser,
    userId: string,
    sessionId: string,
  ) {
    await this.assertTargetVisible(actor, userId);
    const revoked = await this.sessionService.revokeOwned(
      userId,
      sessionId,
      'ADMINISTRATOR_REVOKED',
    );

    if (!revoked) {
      throw new NotFoundException('Active session not found.');
    }
  }

  private async assertLastOrganizationOwnerProtected(
    transaction: Prisma.TransactionClient,
    userId: string,
    replacementAssignments?: UserRoleAssignmentDto[],
  ): Promise<void> {
    const ownerAssignments = await transaction.userRoleAssignment.findMany({
      where: {
        userId,
        isActive: true,
        scope: RoleScope.COMPANY_GROUP,
        role: { code: 'ORGANIZATION_OWNER' },
      },
      select: { companyGroupId: true, roleId: true },
    });
    const companyGroupIds = [
      ...new Set(
        ownerAssignments
          .map((assignment) => assignment.companyGroupId)
          .filter((companyGroupId): companyGroupId is string =>
            Boolean(companyGroupId),
          ),
      ),
    ].sort();

    for (const companyGroupId of companyGroupIds) {
      // Use $executeRaw — pg_advisory_xact_lock returns void, which
      // $queryRaw cannot deserialize through the Prisma driver adapter (P2010).
      await transaction.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${companyGroupId}, 0))`,
      );
    }

    for (const assignment of ownerAssignments) {
      const companyGroupId = assignment.companyGroupId;

      if (!companyGroupId) {
        continue;
      }

      const keepsOwnership = replacementAssignments?.some(
        (candidate) =>
          candidate.scope === RoleScope.COMPANY_GROUP &&
          candidate.companyGroupId === companyGroupId &&
          candidate.roleId === assignment.roleId,
      );

      if (replacementAssignments && keepsOwnership) {
        continue;
      }

      const activeOwners = await transaction.user.count({
        where: {
          status: UserStatus.ACTIVE,
          roleAssignments: {
            some: {
              isActive: true,
              scope: RoleScope.COMPANY_GROUP,
              companyGroupId,
              role: { code: 'ORGANIZATION_OWNER', isActive: true },
            },
          },
        },
      });

      if (activeOwners <= 1) {
        throw new ConflictException({
          code: 'LAST_ORGANIZATION_OWNER',
          message:
            'Assign another active Organization Owner before removing or disabling the last owner.',
        });
      }
    }
  }

  private async resolveInvitationCompanyGroup(
    actor: AuthenticatedUser,
    companyGroupId?: string,
    companyId?: string,
  ): Promise<string | undefined> {
    if (companyGroupId) {
      return companyGroupId;
    }

    if (companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { companyGroupId: true },
      });
      return company?.companyGroupId ?? undefined;
    }

    return actor.authorization.activeCompanyGroupId;
  }

  private async validateEmployee(
    actor: AuthenticatedUser,
    employeeId?: string,
  ): Promise<void> {
    if (!employeeId) {
      return;
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true, branchId: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found.');
    }

    await this.organizationScope.assertCompany(actor, employee.companyId);
    await this.organizationScope.assertBranch(actor, employee.branchId);
  }

  private async validateAssignments(
    actor: AuthenticatedUser,
    assignments: UserRoleAssignmentDto[],
  ): Promise<void> {
    const assignmentKeys = assignments.map((item) => {
      const scopeKey =
        item.scope === RoleScope.GLOBAL
          ? 'GLOBAL'
          : item.scope === RoleScope.COMPANY_GROUP
            ? `COMPANY_GROUP:${item.companyGroupId ?? ''}`
            : item.scope === RoleScope.COMPANY
              ? `COMPANY:${item.companyId ?? ''}`
              : `BRANCH:${item.branchId ?? ''}`;
      return `${item.roleId}:${scopeKey}`;
    });

    if (new Set(assignmentKeys).size !== assignmentKeys.length) {
      throw new BadRequestException(
        'Duplicate role assignments are not allowed.',
      );
    }

    const roleIds = [...new Set(assignments.map((item) => item.roleId))];
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, isActive: true },
      select: {
        id: true,
        code: true,
        isSystem: true,
        companyGroupId: true,
        permissions: {
          select: {
            permission: {
              select: { code: true },
            },
          },
        },
      },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles are invalid.');
    }

    const roleById = new Map(roles.map((role) => [role.id, role]));

    for (const assignment of assignments) {
      const role = roleById.get(assignment.roleId);

      if (
        !actor.authorization.isGlobal &&
        role?.permissions.some(
          (item) => item.permission.code === 'platform.admin',
        )
      ) {
        throw new ForbiddenException(
          'Only a global administrator can grant platform access.',
        );
      }

      if (
        !actor.authorization.isGlobal &&
        role?.permissions.some(
          (item) =>
            !actor.authorization.permissions.includes(item.permission.code),
        )
      ) {
        throw new ForbiddenException(
          'You cannot assign a role that grants permissions you do not hold.',
        );
      }

      if (
        !actor.authorization.isGlobal &&
        role &&
        role.isSystem === false &&
        role.companyGroupId !== actor.authorization.activeCompanyGroupId
      ) {
        throw new ForbiddenException(
          'The selected custom role belongs to another Company Group.',
        );
      }

      if (
        (assignment.scope === RoleScope.GLOBAL ||
          role?.code === 'SUPER_ADMINISTRATOR') &&
        !actor.authorization.isGlobal
      ) {
        throw new ForbiddenException(
          'Only a global administrator can grant global access.',
        );
      }

      if (assignment.scope === RoleScope.GLOBAL && role?.isSystem === false) {
        throw new BadRequestException(
          'Tenant custom roles cannot be assigned at global scope.',
        );
      }

      if (
        role?.code === 'SUPER_ADMINISTRATOR' &&
        assignment.scope !== RoleScope.GLOBAL
      ) {
        throw new BadRequestException(
          'Super Administrator must use global scope.',
        );
      }

      if (
        role?.code === 'ORGANIZATION_OWNER' &&
        assignment.scope !== RoleScope.COMPANY_GROUP
      ) {
        throw new BadRequestException(
          'Organization Owner must use Company Group scope.',
        );
      }

      if (
        assignment.scope === RoleScope.COMPANY_GROUP &&
        role?.code !== 'ORGANIZATION_OWNER' &&
        role?.isSystem
      ) {
        throw new BadRequestException(
          'Only Organization Owner or a tenant custom role can use Company Group scope.',
        );
      }

      if (
        assignment.scope === RoleScope.COMPANY_GROUP &&
        !actor.authorization.isGlobal &&
        actor.authorization.scopeLevel !== RoleScope.COMPANY_GROUP
      ) {
        throw new ForbiddenException(
          'Only a global administrator or Organization Owner can grant Company Group access.',
        );
      }

      if (assignment.scope === RoleScope.GLOBAL) {
        if (
          assignment.companyGroupId ||
          assignment.companyId ||
          assignment.branchId
        ) {
          throw new BadRequestException(
            'Global assignments cannot specify an organization.',
          );
        }
      } else if (assignment.scope === RoleScope.COMPANY_GROUP) {
        if (
          !assignment.companyGroupId ||
          assignment.companyId ||
          assignment.branchId
        ) {
          throw new BadRequestException(
            'Company Group assignments require only a Company Group.',
          );
        }
        this.organizationScope.assertCompanyGroup(
          actor,
          assignment.companyGroupId,
        );
        if (
          role &&
          role.isSystem === false &&
          role.companyGroupId !== assignment.companyGroupId
        ) {
          throw new BadRequestException(
            'The custom role must be assigned inside its Company Group.',
          );
        }
      } else if (assignment.scope === RoleScope.COMPANY) {
        if (
          assignment.companyGroupId ||
          !assignment.companyId ||
          assignment.branchId
        ) {
          throw new BadRequestException(
            'Company assignments require only a company.',
          );
        }
        await this.organizationScope.assertCompany(actor, assignment.companyId);
        if (role && role.isSystem === false && role.companyGroupId) {
          const company = await this.prisma.company.findUnique({
            where: { id: assignment.companyId },
            select: { companyGroupId: true },
          });

          if (company?.companyGroupId !== role.companyGroupId) {
            throw new BadRequestException(
              'The custom role must be assigned inside its Company Group.',
            );
          }
        }
      } else {
        if (
          assignment.companyGroupId ||
          !assignment.companyId ||
          !assignment.branchId
        ) {
          throw new BadRequestException(
            'Branch assignments require a company and branch.',
          );
        }
        await this.organizationScope.assertCompany(actor, assignment.companyId);
        await this.organizationScope.assertBranch(actor, assignment.branchId);
        const branch = await this.prisma.branch.findUnique({
          where: { id: assignment.branchId },
          select: { companyId: true },
        });

        if (!branch || branch.companyId !== assignment.companyId) {
          throw new BadRequestException(
            'The branch does not belong to the selected company.',
          );
        }
        if (role && role.isSystem === false && role.companyGroupId) {
          const company = await this.prisma.company.findUnique({
            where: { id: assignment.companyId },
            select: { companyGroupId: true },
          });

          if (company?.companyGroupId !== role.companyGroupId) {
            throw new BadRequestException(
              'The custom role must be assigned inside its Company Group.',
            );
          }
        }
      }
    }
  }

  private async validateDefaults(
    actor: AuthenticatedUser,
    companyGroupId?: string,
    companyId?: string,
    branchId?: string,
  ): Promise<void> {
    if (companyGroupId) {
      this.organizationScope.assertCompanyGroup(actor, companyGroupId);
    }

    if (companyId) {
      await this.organizationScope.assertCompany(actor, companyId);
    }

    if (branchId) {
      await this.organizationScope.assertBranch(actor, branchId);
    }
  }

  private async validateDefaultAssignments(
    assignments: UserRoleAssignmentDto[],
    companyGroupId?: string,
    companyId?: string,
    branchId?: string,
  ): Promise<void> {
    if (!companyGroupId && !companyId && !branchId) {
      return;
    }

    if (assignments.some((item) => item.scope === RoleScope.GLOBAL)) {
      return;
    }

    if (
      companyGroupId &&
      !assignments.some(
        (item) =>
          item.scope === RoleScope.COMPANY_GROUP &&
          item.companyGroupId === companyGroupId,
      )
    ) {
      throw new BadRequestException(
        'The default Company Group is not covered by a role assignment.',
      );
    }

    let resolvedCompanyId = companyId;

    if (branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
        select: { companyId: true },
      });
      resolvedCompanyId = branch?.companyId;

      const branchAllowed = assignments.some(
        (item) =>
          (item.scope === RoleScope.BRANCH && item.branchId === branchId) ||
          (item.scope === RoleScope.COMPANY &&
            item.companyId === branch?.companyId) ||
          (item.scope === RoleScope.COMPANY_GROUP &&
            item.companyGroupId === companyGroupId),
      );

      if (!branchAllowed) {
        throw new BadRequestException(
          'The default branch is not covered by a role assignment.',
        );
      }
    }

    if (
      resolvedCompanyId &&
      !assignments.some(
        (item) =>
          item.companyId === resolvedCompanyId ||
          (item.scope === RoleScope.COMPANY_GROUP &&
            item.companyGroupId === companyGroupId),
      )
    ) {
      throw new BadRequestException(
        'The default company is not covered by a role assignment.',
      );
    }
  }

  private async assertTargetVisible(actor: AuthenticatedUser, userId: string) {
    const users = await this.findAll(actor);
    const user = users.find((candidate) => candidate.id === userId);

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return user;
  }

  private toAssignmentData(assignment: UserRoleAssignmentDto) {
    const scopeKey =
      assignment.scope === RoleScope.GLOBAL
        ? 'GLOBAL'
        : assignment.scope === RoleScope.COMPANY_GROUP
          ? `COMPANY_GROUP:${assignment.companyGroupId}`
          : assignment.scope === RoleScope.COMPANY
            ? `COMPANY:${assignment.companyId}`
            : `BRANCH:${assignment.branchId}`;

    return {
      roleId: assignment.roleId,
      scope: assignment.scope,
      scopeKey,
      companyGroupId: assignment.companyGroupId,
      companyId: assignment.companyId,
      branchId: assignment.branchId,
    };
  }

  private assignmentWithinCompanyGroup(
    companyGroupId: string,
    activeOnly = true,
  ): Prisma.UserRoleAssignmentWhereInput {
    return {
      ...(activeOnly ? { isActive: true } : {}),
      OR: [
        {
          scope: RoleScope.COMPANY_GROUP,
          companyGroupId,
        },
        {
          scope: RoleScope.COMPANY,
          company: { companyGroupId },
        },
        {
          scope: RoleScope.BRANCH,
          company: { companyGroupId },
        },
      ],
    };
  }

  private assignmentWithinCompany(
    companyId: string,
    branchId?: string,
    activeOnly = true,
  ): Prisma.UserRoleAssignmentWhereInput {
    return {
      ...(activeOnly ? { isActive: true } : {}),
      OR: branchId
        ? [
            {
              scope: RoleScope.BRANCH,
              companyId,
              branchId,
            },
          ]
        : [
            {
              scope: RoleScope.COMPANY,
              companyId,
            },
            {
              scope: RoleScope.BRANCH,
              companyId,
            },
          ],
    };
  }

  private safeUser(user: {
    id: string;
    username: string;
    displayName: string | null;
    email: string | null;
    status: UserStatus;
    mustChangePassword: boolean;
    employeeId: string | null;
    lastLoginAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      employeeId: user.employeeId,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase('en-US');
  }

  private generateUsername(
    displayName: string | undefined,
    normalizedEmail: string,
  ): string {
    const source = displayName || normalizedEmail.split('@')[0] || 'user';
    const base =
      source
        .normalize('NFKD')
        .replace(/[^\p{L}\p{N}]+/gu, '.')
        .replace(/^\.+|\.+$/g, '')
        .toLocaleLowerCase('en-US')
        .slice(0, 48) || 'user';

    return `${base}.${randomBytes(3).toString('hex')}`;
  }
}
