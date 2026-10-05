import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { inclusiveUpperDateFilter } from '../../common/helpers/query-date-bound.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetClearanceService } from '../asset-domain/asset-clearance.service';
import { ASSET_ERROR_CODES } from '../asset-domain/policies/asset-error-codes';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';
import { HrOperationsCommandReceiptService } from '../hr-operations/hr-operations-command-receipt.service';
import { AuditService } from '../audit/audit.service';
import { OutboxWriterService } from '../outbox/outbox-writer.service';

import { ClearanceItemActionDto } from './dto/clearance-item-action.dto';
import { ListEmployeeClearanceDto } from './dto/list-employee-clearance.dto';

type DbClient = Prisma.TransactionClient;
type ClearanceAction = 'CLEAR' | 'REOPEN';

const itemInclude = {
  branch: {
    select: { id: true, branchCode: true, branchName: true },
  },
  clearedBy: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
    },
  },
  executorDepartment: {
    select: { id: true, departmentCode: true, departmentName: true },
  },
  clearance: {
    include: {
      separation: {
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: {
                select: {
                  id: true,
                  departmentCode: true,
                  departmentName: true,
                },
              },
              designation: {
                select: {
                  id: true,
                  designationCode: true,
                  designationName: true,
                },
              },
              company: { select: { companyGroupId: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.EmployeeClearanceItemInclude;

type ClearanceItemRecord = Prisma.EmployeeClearanceItemGetPayload<{
  include: typeof itemInclude;
}>;

export type ClearanceActorDepartment = {
  companyId: string;
  branchId: string;
  departmentId: string;
};

@Injectable()
export class EmployeeClearanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: EmployeeDomainScopeService,
    private readonly assetClearance: AssetClearanceService,
    private readonly receipts: HrOperationsCommandReceiptService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxWriterService,
  ) {}

  /** The Asset domain owns detail records; Separation owns the summary item. */
  async syncAssetClearanceItems(clearanceId: string, tx: DbClient) {
    await this.assetClearance.syncOpenCustodyItems(clearanceId, tx);
  }

  async findAll(query: ListEmployeeClearanceDto, actor: AuthenticatedUser) {
    const actorDepartment = await this.getActorDepartment(actor);
    const canMonitor = this.canMonitor(actor);
    if (!canMonitor && !this.canReadDepartment(actor)) {
      throw new ForbiddenException();
    }
    const showAll = query.queue === 'all' && canMonitor;
    if (!showAll && !actorDepartment) {
      return { items: [], total: 0, page: query.page, limit: query.limit };
    }
    const authorizationWhere: Prisma.EmployeeClearanceItemWhereInput = {
      clearanceType: { not: 'ASSET' },
      clearance: this.scope.employeeClearanceWhere(),
      ...(showAll
        ? {}
        : {
            companyId: actorDepartment!.companyId,
            branchId: actorDepartment!.branchId,
            executorDepartmentId: actorDepartment!.departmentId,
          }),
    };
    const keyword = query.keyword?.trim();
    const separationWhere: Prisma.EmployeeSeparationWhereInput = {
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.lastWorkingDateFrom || query.lastWorkingDateTo
        ? {
            lastWorkingDate: {
              ...(query.lastWorkingDateFrom
                ? { gte: new Date(query.lastWorkingDateFrom) }
                : {}),
              ...(query.lastWorkingDateTo
                ? inclusiveUpperDateFilter(query.lastWorkingDateTo)
                : {}),
            },
          }
        : {}),
    };
    const filterWhere: Prisma.EmployeeClearanceItemWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.responsibleDepartmentId
        ? { executorDepartmentId: query.responsibleDepartmentId }
        : {}),
      ...(query.itemType
        ? { clearanceType: query.itemType.trim().toUpperCase() }
        : {}),
      ...(query.status ? { status: query.status.trim().toUpperCase() } : {}),
      ...(query.mandatory === false
        ? { id: '__no_optional_clearance_item__' }
        : {}),
      ...(Object.keys(separationWhere).length > 0
        ? { clearance: { separation: separationWhere } }
        : {}),
      ...(keyword
        ? {
            OR: [
              { itemName: { contains: keyword, mode: 'insensitive' } },
              {
                clearance: {
                  separation: {
                    id: { contains: keyword, mode: 'insensitive' },
                  },
                },
              },
              {
                clearance: {
                  separation: {
                    reason: { contains: keyword, mode: 'insensitive' },
                  },
                },
              },
              {
                clearance: {
                  separation: {
                    employee: {
                      employeeCode: {
                        contains: keyword,
                        mode: 'insensitive',
                      },
                    },
                  },
                },
              },
              {
                clearance: {
                  separation: {
                    employee: {
                      firstName: { contains: keyword, mode: 'insensitive' },
                    },
                  },
                },
              },
              {
                clearance: {
                  separation: {
                    employee: {
                      lastName: { contains: keyword, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const where: Prisma.EmployeeClearanceItemWhereInput = {
      AND: [authorizationWhere, filterWhere],
    };
    const [items, total] = await Promise.all([
      this.prisma.employeeClearanceItem.findMany({
        where,
        include: itemInclude,
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.employeeClearanceItem.count({ where }),
    ]);
    return {
      items: items.map((item) => this.decorate(item, actor, actorDepartment)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async clear(
    itemId: string,
    dto: ClearanceItemActionDto,
    actor: AuthenticatedUser,
  ) {
    const reason = dto.reason?.trim() || dto.remarks?.trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException({
        code: 'EMPLOYEE_CLEARANCE_CLEAR_REASON_REQUIRED',
      });
    }
    return this.command(itemId, dto, actor, 'CLEAR');
  }

  async reopen(
    itemId: string,
    dto: ClearanceItemActionDto,
    actor: AuthenticatedUser,
  ) {
    const reason = dto.reason?.trim() || dto.remarks?.trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException({
        code: 'EMPLOYEE_CLEARANCE_REOPEN_REASON_REQUIRED',
      });
    }
    return this.command(itemId, dto, actor, 'REOPEN');
  }

  /**
   * Called only from EmployeeSeparationService's idempotent completion command.
   * It keeps the Asset domain assertion and the clearance completion in that same DB
   * transaction, then lets Separation atomically deactivate the employee.
   */
  async finalizeForSeparation(
    tx: DbClient,
    clearanceId: string,
    expectedVersion: number,
    employeeId: string,
    actor: AuthenticatedUser,
  ) {
    const clearance = await tx.employeeClearance.findFirst({
      where: {
        id: clearanceId,
        ...this.scope.employeeClearanceWhere(),
      },
      include: { items: true, separation: true },
    });
    if (!clearance || clearance.separation.employeeId !== employeeId) {
      throw new NotFoundException({ code: 'EMPLOYEE_CLEARANCE_NOT_FOUND' });
    }
    if (
      clearance.version !== expectedVersion ||
      clearance.status !== 'IN_PROGRESS'
    ) {
      throw new ConflictException({ code: 'EMPLOYEE_CLEARANCE_STATE_CHANGED' });
    }

    await this.assetClearance.syncOpenCustodyItems(clearanceId, tx);
    await this.assetClearance.assertResolved(employeeId, tx);

    const assetSummary = clearance.items.find(
      (item) => item.clearanceType === 'ASSET',
    );
    if (!assetSummary) {
      throw new ConflictException({
        code: 'EMPLOYEE_CLEARANCE_ASSET_SUMMARY_MISSING',
      });
    }
    if (assetSummary.status !== 'CLEARED') {
      await tx.employeeClearanceItem.updateMany({
        where: {
          id: assetSummary.id,
          clearanceId,
          version: assetSummary.version,
          status: 'PENDING',
        },
        data: {
          status: 'CLEARED',
          clearedById: actor.employeeId ?? null,
          clearedDate: new Date(),
          remarks: 'Resolved through Assets custody preflight.',
          version: { increment: 1 },
        },
      });
    }
    const pending = await tx.employeeClearanceItem.count({
      where: { clearanceId, status: { not: 'CLEARED' } },
    });
    if (pending > 0) {
      throw new ConflictException({
        code: 'EMPLOYEE_CLEARANCE_ITEMS_INCOMPLETE',
        message: 'All Department clearance items must be cleared.',
      });
    }
    const completed = await tx.employeeClearance.updateMany({
      where: {
        id: clearanceId,
        version: expectedVersion,
        status: 'IN_PROGRESS',
      },
      data: {
        status: 'COMPLETED',
        completedByUserId: actor.id,
        completedDate: new Date(),
        version: { increment: 1 },
      },
    });
    if (completed.count !== 1) {
      throw new ConflictException({ code: 'EMPLOYEE_CLEARANCE_STATE_CHANGED' });
    }
    await this.audit.log(
      'EmployeeClearance',
      clearanceId,
      'COMPLETE',
      { status: clearance.status },
      { status: 'COMPLETED' },
      { tx, userId: actor.id },
    );
  }

  async getActorDepartment(
    actor: AuthenticatedUser,
    db: PrismaService | DbClient = this.prisma,
  ): Promise<ClearanceActorDepartment | null> {
    if (!actor.employeeId) return null;
    const employee = await db.employee.findFirst({
      where: {
        id: actor.employeeId,
        isActive: true,
        ...this.scope.employeeWhere(),
      },
      select: { companyId: true, branchId: true, departmentId: true },
    });
    return employee ?? null;
  }

  allowedActionsForItem(
    item: Pick<
      ClearanceItemRecord,
      | 'clearanceType'
      | 'companyId'
      | 'branchId'
      | 'executorDepartmentId'
      | 'status'
    > & {
      clearance?: { status: string; separation?: { status: string } };
    },
    actor: AuthenticatedUser,
    actorDepartment: ClearanceActorDepartment | null,
  ): Array<'CLEAR' | 'REOPEN'> {
    if (
      item.clearanceType === 'ASSET' ||
      !item.executorDepartmentId ||
      item.clearance?.status !== 'IN_PROGRESS' ||
      item.clearance.separation?.status !== 'CLEARANCE_IN_PROGRESS'
    ) {
      return [];
    }

    const sameCompanyBranch =
      Boolean(actorDepartment) &&
      item.companyId === actorDepartment!.companyId &&
      item.branchId === actorDepartment!.branchId;

    const canClearAsDepartmentOwner =
      this.canManageDepartment(actor) &&
      sameCompanyBranch &&
      item.executorDepartmentId === actorDepartment!.departmentId;

    // HR with employee manage can clear any department checklist (ops path).
    const canClearAsHrOps =
      this.canManageEmployees(actor) &&
      (!actorDepartment ||
        (item.companyId === actorDepartment.companyId &&
          item.branchId === actorDepartment.branchId));

    if (!canClearAsDepartmentOwner && !canClearAsHrOps) {
      return [];
    }
    if (item.status === 'PENDING') return ['CLEAR'];
    if (item.status === 'CLEARED') return ['REOPEN'];
    return [];
  }

  private async command(
    itemId: string,
    dto: ClearanceItemActionDto,
    actor: AuthenticatedUser,
    action: ClearanceAction,
  ) {
    const companyId = this.requireActiveCompany();
    return this.receipts.execute({
      companyId,
      actorUserId: actor.id,
      commandType: `${action}_EMPLOYEE_CLEARANCE_ITEM`,
      operationId: dto.operationId,
      requestPayload: {
        itemId,
        expectedVersion: dto.expectedVersion,
        reason: dto.reason?.trim() || null,
        remarks: dto.remarks?.trim() || null,
      },
      execute: async (tx) => {
        const item = await this.findItemInScope(tx, itemId);
        if (item.companyId !== companyId) {
          throw new NotFoundException({
            code: 'EMPLOYEE_CLEARANCE_ITEM_NOT_FOUND',
          });
        }
        if (item.version !== dto.expectedVersion) {
          throw new ConflictException({
            code: 'EMPLOYEE_CLEARANCE_ITEM_STATE_CHANGED',
          });
        }
        if (item.clearanceType === 'ASSET') {
          throw new BadRequestException({
            code: ASSET_ERROR_CODES.ASSET_CLEARANCE_MANAGED,
            message:
              'Asset clearance must be resolved through Assets or an approved waiver.',
          });
        }
        const actorDepartment = await this.getActorDepartment(actor, tx);
        if (
          !this.allowedActionsForItem(item, actor, actorDepartment).includes(
            action,
          )
        ) {
          throw new ForbiddenException({
            code: 'EMPLOYEE_CLEARANCE_DEPARTMENT_ACTION_NOT_ALLOWED',
          });
        }
        if (
          (action === 'CLEAR' || action === 'REOPEN') &&
          !this.commandReason(dto)
        ) {
          throw new BadRequestException({
            code:
              action === 'CLEAR'
                ? 'EMPLOYEE_CLEARANCE_CLEAR_REASON_REQUIRED'
                : 'EMPLOYEE_CLEARANCE_REOPEN_REASON_REQUIRED',
          });
        }

        const transitioned = await tx.employeeClearanceItem.updateMany({
          where: {
            id: itemId,
            companyId,
            version: dto.expectedVersion,
            status: action === 'CLEAR' ? 'PENDING' : 'CLEARED',
          },
          data:
            action === 'CLEAR'
              ? {
                  status: 'CLEARED',
                  clearedById: actor.employeeId,
                  clearedDate: new Date(),
                  remarks: this.commandReason(dto),
                  version: { increment: 1 },
                }
              : {
                  status: 'PENDING',
                  clearedById: null,
                  clearedDate: null,
                  remarks: this.commandReason(dto),
                  version: { increment: 1 },
                },
        });
        if (transitioned.count !== 1) {
          throw new ConflictException({
            code: 'EMPLOYEE_CLEARANCE_ITEM_STATE_CHANGED',
          });
        }
        const clearanceUpdated = await tx.employeeClearance.updateMany({
          where: {
            id: item.clearanceId,
            companyId,
            version: item.clearance.version,
            status: 'IN_PROGRESS',
          },
          data: { version: { increment: 1 } },
        });
        if (clearanceUpdated.count !== 1) {
          throw new ConflictException({
            code: 'EMPLOYEE_CLEARANCE_STATE_CHANGED',
          });
        }
        const updated = await this.findItemInScope(tx, itemId);
        await this.audit.log(
          'EmployeeClearanceItem',
          itemId,
          action,
          {
            status: item.status,
            clearedById: item.clearedById,
          },
          {
            status: updated.status,
            clearedById: updated.clearedById,
          },
          { tx, userId: actor.id },
        );
        await this.outbox.write(tx, {
          aggregateType: 'EmployeeSeparation',
          aggregateId: updated.clearance.separation.id,
          eventType:
            action === 'CLEAR'
              ? 'EMPLOYEE_CLEARANCE_ITEM_CLEARED'
              : 'EMPLOYEE_CLEARANCE_ITEM_REOPENED',
          dedupeKey: `employee-clearance-item:${itemId}:${action.toLowerCase()}:${updated.version}`,
          companyId: updated.companyId,
          branchId: updated.branchId,
          companyGroupId:
            updated.clearance.separation.employee.company.companyGroupId,
          payload: {
            employeeId: updated.clearance.separation.employeeId,
            clearanceId: updated.clearanceId,
            clearanceItemId: itemId,
            clearanceType: updated.clearanceType,
            status: updated.status,
            recipientUserIds: [actor.id],
          },
        });
        const result = this.decorate(updated, actor, actorDepartment);
        return { snapshot: this.snapshot(result), result };
      },
    });
  }

  private async findItemInScope(db: PrismaService | DbClient, id: string) {
    const item = await db.employeeClearanceItem.findFirst({
      where: {
        id,
        clearance: this.scope.employeeClearanceWhere(),
      },
      include: itemInclude,
    });
    if (!item) {
      throw new NotFoundException({
        code: 'EMPLOYEE_CLEARANCE_ITEM_NOT_FOUND',
      });
    }
    return item;
  }

  private decorate(
    item: ClearanceItemRecord,
    actor: AuthenticatedUser,
    actorDepartment: ClearanceActorDepartment | null,
  ) {
    const allowedActions = this.allowedActionsForItem(
      item,
      actor,
      actorDepartment,
    );
    const employee = item.clearance.separation.employee;
    const separation = item.clearance.separation;
    return {
      id: item.id,
      separationId: item.clearance.separationId,
      clearanceId: item.clearanceId,
      executorDepartmentId: item.executorDepartmentId,
      executorDepartmentName: item.executorDepartment?.departmentName ?? null,
      branch: item.branch,
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        firstName: employee.firstName,
        lastName: employee.lastName,
        department: employee.department,
        designation: employee.designation,
      },
      separation: {
        id: separation.id,
        separationType: separation.separationType,
        reason: separation.reason,
        lastWorkingDate: separation.lastWorkingDate,
        createdAt: separation.createdAt,
      },
      itemType: item.clearanceType,
      title: item.itemName,
      mandatory: item.clearanceType !== 'ASSET',
      status: item.status,
      version: item.version,
      clearedAt: item.clearedDate,
      clearedBy: item.clearedBy,
      allowedActions,
      actionRequirements: {
        expectedVersion: item.version,
        requiresReason:
          allowedActions.includes('CLEAR') || allowedActions.includes('REOPEN'),
      },
    };
  }

  private commandReason(dto: ClearanceItemActionDto) {
    const reason = dto.reason?.trim() || dto.remarks?.trim() || '';
    return reason.length >= 3 ? reason : null;
  }

  private canManageDepartment(actor: AuthenticatedUser) {
    return (
      actor.authorization.isGlobal ||
      actor.authorization.permissions.includes('hr.clearance.department.manage')
    );
  }

  private canManageEmployees(actor: AuthenticatedUser) {
    return (
      actor.authorization.isGlobal ||
      actor.authorization.permissions.includes('hr.employees.manage')
    );
  }

  private canReadDepartment(actor: AuthenticatedUser) {
    return (
      this.canManageDepartment(actor) ||
      actor.authorization.permissions.includes('hr.clearance.department.read')
    );
  }

  private canMonitor(actor: AuthenticatedUser) {
    return (
      actor.authorization.isGlobal ||
      actor.authorization.permissions.includes('hr.employees.read') ||
      actor.authorization.permissions.includes('hr.employees.manage')
    );
  }

  private requireActiveCompany() {
    const companyId = this.scope.current().activeCompanyId;
    if (!companyId) {
      throw new ForbiddenException({ code: 'COMPANY_SCOPE_REQUIRED' });
    }
    return companyId;
  }

  private snapshot(result: Record<string, unknown>) {
    return JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
  }
}
