import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SecurityEventType } from '@prisma/client';

import { getRequestId } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NumberSeriesService } from '../number-series';
import type { AuthenticatedUser } from './auth.types';
import { SessionService } from './session.service';

@Injectable()
export class RoleAdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly numberSeries: NumberSeriesService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    actor: AuthenticatedUser,
    input: {
      name: string;
      description?: string;
      permissionIds: string[];
    },
  ) {
    const companyGroupId = this.activeCompanyGroupId(actor);
    const normalizedName = this.normalize(input.name);
    await this.assertNameAvailable(companyGroupId, normalizedName);
    const permissionIds = await this.validPermissionIds(
      actor,
      input.permissionIds,
    );

    const code = await this.customRoleCode(companyGroupId);

    return this.prisma.$transaction(async (transaction) => {
      const role = await transaction.role.create({
        data: {
          code,
          name: input.name.trim(),
          normalizedName,
          description: input.description?.trim() || null,
          companyGroupId,
          isSystem: false,
          permissions: {
            create: permissionIds.map((permissionId) => ({
              permissionId,
            })),
          },
        },
        include: this.roleInclude(),
      });
      await this.auditService.log(
        'Role',
        role.id,
        'CREATE',
        undefined,
        {
          code: role.code,
          name: role.name,
          permissionIds,
        },
        { userId: actor.id, tx: transaction },
      );
      return role;
    });
  }

  async clone(
    actor: AuthenticatedUser,
    roleId: string,
    requestedName?: string,
  ) {
    const companyGroupId = this.activeCompanyGroupId(actor);
    const source = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ isSystem: true }, { isSystem: false, companyGroupId }],
      },
      include: {
        permissions: {
          where: { permission: { isTenantAssignable: true } },
          select: { permissionId: true },
        },
      },
    });

    if (!source) {
      throw new NotFoundException('Role not found.');
    }

    const name = (requestedName ?? `${source.name} Copy`).trim();
    return this.create(actor, {
      name,
      description: source.description ?? undefined,
      permissionIds: source.permissions.map((item) => item.permissionId),
    });
  }

  async update(
    actor: AuthenticatedUser,
    roleId: string,
    input: { name?: string; description?: string },
  ) {
    const role = await this.assertEditable(actor, roleId);
    const nextName = input.name?.trim();
    const normalizedName = nextName ? this.normalize(nextName) : undefined;

    if (normalizedName && normalizedName !== role.normalizedName) {
      await this.assertNameAvailable(role.companyGroupId, normalizedName);
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.role.update({
        where: { id: role.id },
        data: {
          ...(nextName ? { name: nextName, normalizedName } : {}),
          ...(input.description !== undefined
            ? { description: input.description.trim() || null }
            : {}),
        },
        include: this.roleInclude(),
      });
      await this.auditService.log(
        'Role',
        updated.id,
        'UPDATE',
        { name: role.normalizedName },
        {
          name: updated.name,
          description: updated.description,
        },
        { userId: actor.id, tx: transaction },
      );
      return updated;
    });
  }

  async replacePermissions(
    actor: AuthenticatedUser,
    roleId: string,
    requestedPermissionIds: string[],
  ) {
    const role = await this.assertEditable(actor, roleId);
    const permissionIds = await this.validPermissionIds(
      actor,
      requestedPermissionIds,
    );
    const affectedUserIds = await this.assignedUserIds(role.id);

    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.rolePermission.deleteMany({
        where: { roleId: role.id },
      });

      if (permissionIds.length > 0) {
        await transaction.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
        });
      }

      if (affectedUserIds.length > 0) {
        await transaction.user.updateMany({
          where: { id: { in: affectedUserIds } },
          data: { securityVersion: { increment: 1 } },
        });
        await transaction.securityEvent.createMany({
          data: affectedUserIds.map((userId) => ({
            userId,
            type: SecurityEventType.ROLE_CHANGED,
            requestId: getRequestId(),
            metadata: {
              action: 'PERMISSIONS_REPLACED',
              roleId: role.id,
            },
          })),
        });
      }

      const updatedRole = await transaction.role.findUniqueOrThrow({
        where: { id: role.id },
        include: this.roleInclude(),
      });
      await this.auditService.log(
        'Role',
        role.id,
        'UPDATE',
        undefined,
        {
          action: 'PERMISSIONS_REPLACED',
          permissionIds,
        },
        { userId: actor.id, tx: transaction },
      );
      const sessionIds = await this.revokeAffectedSessionsInTransaction(
        transaction,
        affectedUserIds,
        'ROLE_PERMISSIONS_CHANGED',
      );
      return { role: updatedRole, sessionIds };
    });

    await this.sessionService.invalidateSessionIds(updated.sessionIds);
    return updated.role;
  }

  async updateStatus(
    actor: AuthenticatedUser,
    roleId: string,
    isActive: boolean,
  ) {
    const role = await this.assertEditable(actor, roleId);
    const affectedUserIds = await this.assignedUserIds(role.id);

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.role.update({
        where: { id: role.id },
        data: { isActive },
        include: this.roleInclude(),
      });

      if (affectedUserIds.length > 0) {
        await transaction.user.updateMany({
          where: { id: { in: affectedUserIds } },
          data: { securityVersion: { increment: 1 } },
        });
        await transaction.securityEvent.createMany({
          data: affectedUserIds.map((userId) => ({
            userId,
            type: SecurityEventType.ROLE_CHANGED,
            requestId: getRequestId(),
            metadata: {
              action: isActive ? 'ROLE_ACTIVATED' : 'ROLE_DEACTIVATED',
              roleId: role.id,
            },
          })),
        });
      }

      await this.auditService.log(
        'Role',
        role.id,
        'UPDATE',
        { isActive: role.isActive },
        {
          action: isActive ? 'ROLE_ACTIVATED' : 'ROLE_DEACTIVATED',
          isActive,
        },
        { userId: actor.id, tx: transaction },
      );
      const sessionIds = await this.revokeAffectedSessionsInTransaction(
        transaction,
        affectedUserIds,
        'ROLE_STATUS_CHANGED',
      );
      return { result, sessionIds };
    });

    await this.sessionService.invalidateSessionIds(updated.sessionIds);
    return updated.result;
  }

  private async assertEditable(actor: AuthenticatedUser, roleId: string) {
    const companyGroupId = this.activeCompanyGroupId(actor);
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        isSystem: true,
        isActive: true,
        companyGroupId: true,
        normalizedName: true,
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be modified.');
    }

    if (role.companyGroupId !== companyGroupId) {
      throw new NotFoundException('Role not found.');
    }

    return {
      ...role,
      companyGroupId,
    };
  }

  private activeCompanyGroupId(actor: AuthenticatedUser): string {
    const companyGroupId = actor.authorization.activeCompanyGroupId;

    if (!companyGroupId) {
      throw new BadRequestException(
        'Select a Company Group before managing custom roles.',
      );
    }

    return companyGroupId;
  }

  private async validPermissionIds(
    actor: AuthenticatedUser,
    requestedPermissionIds: string[],
  ): Promise<string[]> {
    const permissionIds = [...new Set(requestedPermissionIds)];
    const permissions = await this.prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
        isTenantAssignable: true,
      },
      select: { id: true, code: true },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException(
        'One or more permissions cannot be assigned to a tenant role.',
      );
    }

    if (
      !actor.authorization.isGlobal &&
      permissions.some(
        (permission) =>
          !actor.authorization.permissions.includes(permission.code),
      )
    ) {
      throw new ForbiddenException(
        'You cannot grant a permission that you do not hold.',
      );
    }

    return permissionIds;
  }

  private async assertNameAvailable(
    companyGroupId: string,
    normalizedName: string,
  ): Promise<void> {
    const existing = await this.prisma.role.findFirst({
      where: { companyGroupId, normalizedName },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'A custom role with this name already exists.',
      );
    }
  }

  private async assignedUserIds(roleId: string): Promise<string[]> {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { roleId, isActive: true },
      distinct: ['userId'],
      select: { userId: true },
    });
    return assignments.map((assignment) => assignment.userId);
  }

  private async revokeAffectedSessionsInTransaction(
    transaction: Prisma.TransactionClient,
    userIds: string[],
    reason: string,
  ): Promise<string[]> {
    const sessionIds: string[] = [];
    for (const userId of userIds) {
      sessionIds.push(
        ...(await this.sessionService.revokeAllInTransaction(
          transaction,
          userId,
          reason,
        )),
      );
    }
    return sessionIds;
  }

  private roleInclude() {
    return {
      permissions: {
        select: {
          permission: {
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              isTenantAssignable: true,
            },
          },
        },
      },
    } as const;
  }

  private customRoleCode(companyGroupId: string): Promise<string> {
    const groupFragment = companyGroupId.replaceAll('-', '');
    return this.numberSeries.next(
      'ROLE',
      companyGroupId,
      `ROLE-${groupFragment}`,
      4,
    );
  }

  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase('en-US');
  }
}
