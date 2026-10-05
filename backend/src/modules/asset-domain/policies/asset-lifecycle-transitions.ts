import {
  AssetKind,
  AssetLifecycleStatus,
  AssetTrackingMode,
} from '@prisma/client';

import { ASSET_ERROR_CODES } from './asset-error-codes';

/** Lifecycle commands that mutate AssetLifecycleStatus (plan §4.15). */
export const ASSET_LIFECYCLE_COMMAND = {
  SEND_TO_REPAIR: 'SEND_TO_REPAIR',
  COMPLETE_REPAIR: 'COMPLETE_REPAIR',
  CLOSE_CUSTODY_AS_LOST: 'CLOSE_CUSTODY_AS_LOST',
  APPROVE_WAIVER_TO_LOST: 'APPROVE_WAIVER_TO_LOST',
  MARK_LOST: 'MARK_LOST',
  DISPOSE: 'DISPOSE',
  SUSPEND: 'SUSPEND',
  RESUME: 'RESUME',
  RETIRE: 'RETIRE',
} as const;

export type AssetLifecycleCommand =
  (typeof ASSET_LIFECYCLE_COMMAND)[keyof typeof ASSET_LIFECYCLE_COMMAND];

export interface AssetLifecycleTransitionContext {
  trackingMode: AssetTrackingMode;
  kind: AssetKind;
  hasOpenCustody: boolean;
  hasOpenRequest: boolean;
  hasActiveAllocations: boolean;
  isAssignedIndividual: boolean;
  repairDetailsPresent?: boolean;
}

export interface AssetLifecycleTransitionRule {
  trackingModes: readonly AssetTrackingMode[];
  from: AssetLifecycleStatus;
  command: AssetLifecycleCommand;
  to: AssetLifecycleStatus;
  requiresNoOpenCustody?: boolean;
  requiresNoOpenRequest?: boolean;
  requiresOpenCustodyClosure?: boolean;
  requiresNoActiveAllocations?: boolean;
  requiresUnassignedIndividual?: boolean;
  requiresRepairDetails?: boolean;
  individualOnly?: boolean;
  poolOnly?: boolean;
}

/**
 * Authoritative lifecycle transition matrix (plan §4.15).
 * Archive state is orthogonal — reactivating archived rows never revives
 * DISPOSED, LOST, or RETIRED assets.
 */
export const ASSET_LIFECYCLE_TRANSITION_RULES: readonly AssetLifecycleTransitionRule[] =
  [
    {
      trackingModes: [AssetTrackingMode.LOCATION, AssetTrackingMode.INDIVIDUAL],
      from: AssetLifecycleStatus.ACTIVE,
      command: ASSET_LIFECYCLE_COMMAND.SEND_TO_REPAIR,
      to: AssetLifecycleStatus.IN_REPAIR,
      requiresNoOpenCustody: true,
      requiresNoOpenRequest: true,
    },
    {
      trackingModes: [AssetTrackingMode.LOCATION, AssetTrackingMode.INDIVIDUAL],
      from: AssetLifecycleStatus.IN_REPAIR,
      command: ASSET_LIFECYCLE_COMMAND.COMPLETE_REPAIR,
      to: AssetLifecycleStatus.ACTIVE,
      requiresRepairDetails: true,
    },
    {
      trackingModes: [AssetTrackingMode.INDIVIDUAL],
      from: AssetLifecycleStatus.ACTIVE,
      command: ASSET_LIFECYCLE_COMMAND.CLOSE_CUSTODY_AS_LOST,
      to: AssetLifecycleStatus.LOST,
      requiresOpenCustodyClosure: true,
      individualOnly: true,
    },
    {
      trackingModes: [AssetTrackingMode.INDIVIDUAL],
      from: AssetLifecycleStatus.ACTIVE,
      command: ASSET_LIFECYCLE_COMMAND.APPROVE_WAIVER_TO_LOST,
      to: AssetLifecycleStatus.LOST,
      requiresOpenCustodyClosure: true,
      individualOnly: true,
    },
    {
      trackingModes: [AssetTrackingMode.LOCATION, AssetTrackingMode.INDIVIDUAL],
      from: AssetLifecycleStatus.ACTIVE,
      command: ASSET_LIFECYCLE_COMMAND.MARK_LOST,
      to: AssetLifecycleStatus.LOST,
      requiresNoOpenCustody: true,
      requiresUnassignedIndividual: true,
    },
    {
      trackingModes: [AssetTrackingMode.LOCATION, AssetTrackingMode.INDIVIDUAL],
      from: AssetLifecycleStatus.ACTIVE,
      command: ASSET_LIFECYCLE_COMMAND.DISPOSE,
      to: AssetLifecycleStatus.DISPOSED,
      requiresNoOpenCustody: true,
      requiresNoOpenRequest: true,
    },
    {
      trackingModes: [AssetTrackingMode.LOCATION, AssetTrackingMode.INDIVIDUAL],
      from: AssetLifecycleStatus.IN_REPAIR,
      command: ASSET_LIFECYCLE_COMMAND.DISPOSE,
      to: AssetLifecycleStatus.DISPOSED,
      requiresNoOpenCustody: true,
      requiresNoOpenRequest: true,
    },
    {
      trackingModes: [AssetTrackingMode.LOCATION, AssetTrackingMode.INDIVIDUAL],
      from: AssetLifecycleStatus.LOST,
      command: ASSET_LIFECYCLE_COMMAND.DISPOSE,
      to: AssetLifecycleStatus.DISPOSED,
      requiresNoOpenCustody: true,
      requiresNoOpenRequest: true,
    },
    {
      trackingModes: [AssetTrackingMode.POOL],
      from: AssetLifecycleStatus.ACTIVE,
      command: ASSET_LIFECYCLE_COMMAND.SUSPEND,
      to: AssetLifecycleStatus.SUSPENDED,
      poolOnly: true,
    },
    {
      trackingModes: [AssetTrackingMode.POOL],
      from: AssetLifecycleStatus.SUSPENDED,
      command: ASSET_LIFECYCLE_COMMAND.RESUME,
      to: AssetLifecycleStatus.ACTIVE,
      poolOnly: true,
    },
    {
      trackingModes: [AssetTrackingMode.POOL],
      from: AssetLifecycleStatus.ACTIVE,
      command: ASSET_LIFECYCLE_COMMAND.RETIRE,
      to: AssetLifecycleStatus.RETIRED,
      requiresNoActiveAllocations: true,
      requiresNoOpenRequest: true,
      poolOnly: true,
    },
    {
      trackingModes: [AssetTrackingMode.POOL],
      from: AssetLifecycleStatus.SUSPENDED,
      command: ASSET_LIFECYCLE_COMMAND.RETIRE,
      to: AssetLifecycleStatus.RETIRED,
      requiresNoActiveAllocations: true,
      requiresNoOpenRequest: true,
      poolOnly: true,
    },
  ];

export const ASSET_TERMINAL_LIFECYCLE_STATUSES = new Set<AssetLifecycleStatus>([
  AssetLifecycleStatus.DISPOSED,
  AssetLifecycleStatus.RETIRED,
]);

export function isTerminalLifecycleStatus(
  status: AssetLifecycleStatus,
): boolean {
  return ASSET_TERMINAL_LIFECYCLE_STATUSES.has(status);
}

function ruleMatchesContext(
  rule: AssetLifecycleTransitionRule,
  context: AssetLifecycleTransitionContext,
): boolean {
  if (!rule.trackingModes.includes(context.trackingMode)) {
    return false;
  }

  if (
    rule.individualOnly &&
    context.trackingMode !== AssetTrackingMode.INDIVIDUAL
  ) {
    return false;
  }

  if (rule.poolOnly && context.trackingMode !== AssetTrackingMode.POOL) {
    return false;
  }

  if (rule.requiresNoOpenCustody && context.hasOpenCustody) {
    return false;
  }

  if (rule.requiresNoOpenRequest && context.hasOpenRequest) {
    return false;
  }

  if (rule.requiresOpenCustodyClosure && !context.hasOpenCustody) {
    return false;
  }

  if (rule.requiresNoActiveAllocations && context.hasActiveAllocations) {
    return false;
  }

  if (
    rule.requiresUnassignedIndividual &&
    context.trackingMode === AssetTrackingMode.INDIVIDUAL &&
    context.isAssignedIndividual
  ) {
    return false;
  }

  if (rule.requiresRepairDetails && !context.repairDetailsPresent) {
    return false;
  }

  return true;
}

export function resolveLifecycleTransition(
  from: AssetLifecycleStatus,
  command: AssetLifecycleCommand,
  context: AssetLifecycleTransitionContext,
): AssetLifecycleStatus | null {
  const rule = ASSET_LIFECYCLE_TRANSITION_RULES.find(
    (candidate) =>
      candidate.from === from &&
      candidate.command === command &&
      ruleMatchesContext(candidate, context),
  );

  return rule?.to ?? null;
}

export function assertLifecycleTransition(
  from: AssetLifecycleStatus,
  command: AssetLifecycleCommand,
  context: AssetLifecycleTransitionContext,
): AssetLifecycleStatus {
  const next = resolveLifecycleTransition(from, command, context);

  if (!next) {
    throw new Error(ASSET_ERROR_CODES.ASSET_INVALID_STATE_TRANSITION);
  }

  return next;
}

export function isAllowedLifecycleTransition(
  from: AssetLifecycleStatus,
  command: AssetLifecycleCommand,
  context: AssetLifecycleTransitionContext,
): boolean {
  return resolveLifecycleTransition(from, command, context) !== null;
}

/** Legacy custody status strings mapped to V2 lifecycle during backfill (plan §5.4). */
export const LEGACY_ASSET_STATUS_TO_LIFECYCLE: Readonly<
  Record<string, AssetLifecycleStatus>
> = {
  AVAILABLE: AssetLifecycleStatus.ACTIVE,
  ASSIGNED: AssetLifecycleStatus.ACTIVE,
  REPAIR: AssetLifecycleStatus.IN_REPAIR,
  LOST: AssetLifecycleStatus.LOST,
  DISPOSED: AssetLifecycleStatus.DISPOSED,
};
