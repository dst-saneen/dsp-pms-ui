import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  activeCompanyGroupId?: string;
  activeCompanyId?: string;
  activeBranchId?: string;
  scopeLevel?: 'GLOBAL' | 'COMPANY_GROUP' | 'COMPANY' | 'BRANCH';
  isGlobal?: boolean;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

export function setRequestActor(actor: {
  userId: string;
  sessionId: string;
  activeCompanyGroupId?: string;
  activeCompanyId?: string;
  activeBranchId?: string;
  scopeLevel?: 'GLOBAL' | 'COMPANY_GROUP' | 'COMPANY' | 'BRANCH';
  isGlobal?: boolean;
}): void {
  const context = requestContextStorage.getStore();

  if (!context) {
    return;
  }

  context.userId = actor.userId;
  context.sessionId = actor.sessionId;
  context.activeCompanyGroupId = actor.activeCompanyGroupId;
  context.activeCompanyId = actor.activeCompanyId;
  context.activeBranchId = actor.activeBranchId;
  context.scopeLevel = actor.scopeLevel;
  context.isGlobal = actor.isGlobal;
}

export function getRequestActor(): Pick<
  RequestContext,
  | 'userId'
  | 'sessionId'
  | 'activeCompanyGroupId'
  | 'activeCompanyId'
  | 'activeBranchId'
> {
  const context = requestContextStorage.getStore();

  return {
    userId: context?.userId,
    sessionId: context?.sessionId,
    activeCompanyGroupId: context?.activeCompanyGroupId,
    activeCompanyId: context?.activeCompanyId,
    activeBranchId: context?.activeBranchId,
  };
}

export function getOrganizationScope(): Pick<
  RequestContext,
  | 'activeCompanyGroupId'
  | 'activeCompanyId'
  | 'activeBranchId'
  | 'scopeLevel'
  | 'isGlobal'
> {
  const context = requestContextStorage.getStore();

  return {
    activeCompanyGroupId: context?.activeCompanyGroupId,
    activeCompanyId: context?.activeCompanyId,
    activeBranchId: context?.activeBranchId,
    scopeLevel: context?.scopeLevel,
    isGlobal: context?.isGlobal,
  };
}
