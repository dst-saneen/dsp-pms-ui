import {
  AssetKind,
  AssetLifecycleStatus,
  AssetTrackingMode,
} from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { ASSET_ERROR_CODES } from './asset-error-codes';

const ELIGIBLE_EMPLOYMENT_STATUSES = new Set([
  'PENDING_ONBOARDING',
  'PROBATION',
  'ACTIVE',
  'NOTICE',
]);

const TERMINAL_EMPLOYMENT_STATUSES = new Set(['TERMINATED', 'RESIGNED']);
const NON_TERMINAL_SEPARATION_STATUSES = new Set(['SUBMITTED', 'APPROVED']);

export interface AssetEmployeeEligibilityInput {
  isActive: boolean;
  employmentStatus: string;
  hasNonTerminalSeparation: boolean;
  hasStartedClearance: boolean;
}

export const ELIGIBLE_EMPLOYMENT_STATUS_LIST = [
  'PENDING_ONBOARDING',
  'PROBATION',
  'ACTIVE',
  'NOTICE',
] as const;

export function assertEmployeeEligibleForAsset(
  employee: AssetEmployeeEligibilityInput,
) {
  if (
    !employee.isActive ||
    TERMINAL_EMPLOYMENT_STATUSES.has(employee.employmentStatus) ||
    !ELIGIBLE_EMPLOYMENT_STATUSES.has(employee.employmentStatus)
  ) {
    throw new DomainConflictException(
      ASSET_ERROR_CODES.EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET,
      'Employee is inactive or no longer eligible for asset assignment',
    );
  }

  if (
    employee.hasStartedClearance ||
    (employee.hasNonTerminalSeparation &&
      employee.employmentStatus !== 'NOTICE')
  ) {
    throw new DomainConflictException(
      ASSET_ERROR_CODES.EMPLOYEE_ASSET_CLEARANCE_ACTIVE,
      'Employee has an active separation or asset clearance',
    );
  }

  if (employee.employmentStatus === 'NOTICE' && employee.hasStartedClearance) {
    throw new DomainConflictException(
      ASSET_ERROR_CODES.EMPLOYEE_ASSET_CLEARANCE_ACTIVE,
      'Employee has an active separation or asset clearance',
    );
  }
}

export function isEmployeeEligibleForAssetQuery(
  input: AssetEmployeeEligibilityInput,
): boolean {
  try {
    assertEmployeeEligibleForAsset(input);
    return true;
  } catch {
    return false;
  }
}

export function isNonTerminalSeparationStatus(status: string): boolean {
  return NON_TERMINAL_SEPARATION_STATUSES.has(status);
}

export function assertIndividualAssetAssignable(asset: {
  kind: AssetKind | null;
  trackingMode: AssetTrackingMode | null;
  lifecycleStatus: AssetLifecycleStatus;
  isActive: boolean;
  archivedAt: Date | null;
  warrantyExpiry: Date | null;
}) {
  if (
    !asset.isActive ||
    asset.archivedAt ||
    asset.lifecycleStatus !== AssetLifecycleStatus.ACTIVE
  ) {
    throw new DomainConflictException(
      ASSET_ERROR_CODES.ASSET_NOT_AVAILABLE,
      'Asset is not available for assignment',
    );
  }

  if (
    asset.trackingMode &&
    asset.trackingMode !== AssetTrackingMode.INDIVIDUAL
  ) {
    throw new DomainConflictException(
      ASSET_ERROR_CODES.ASSET_INVALID_STATE_TRANSITION,
      'Only individually tracked assets can be assigned',
    );
  }

  if (isPastCalendarDate(asset.warrantyExpiry)) {
    throw new DomainConflictException(
      ASSET_ERROR_CODES.ASSET_EXPIRED,
      'Asset is expired',
    );
  }
}

export function assertLicensePoolAllocatable(asset: {
  kind: AssetKind | null;
  trackingMode: AssetTrackingMode | null;
  lifecycleStatus: AssetLifecycleStatus;
  isActive: boolean;
  archivedAt: Date | null;
}) {
  if (
    asset.kind !== AssetKind.SOFTWARE_LICENSE ||
    asset.trackingMode !== AssetTrackingMode.POOL
  ) {
    throw new DomainNotFoundException(
      ASSET_ERROR_CODES.ASSET_NOT_FOUND,
      'Asset not found',
    );
  }

  if (asset.archivedAt || !asset.isActive) {
    throw new DomainConflictException(
      ASSET_ERROR_CODES.LICENSE_POOL_NOT_ACTIVE,
      'Licence pool is not active',
    );
  }

  if (asset.lifecycleStatus === AssetLifecycleStatus.SUSPENDED) {
    throw new DomainConflictException(
      ASSET_ERROR_CODES.LICENSE_POOL_NOT_ACTIVE,
      'Licence pool is suspended',
    );
  }

  if (asset.lifecycleStatus !== AssetLifecycleStatus.ACTIVE) {
    throw new DomainConflictException(
      ASSET_ERROR_CODES.LICENSE_POOL_NOT_ACTIVE,
      'Licence pool is not active',
    );
  }
}

export function isPastCalendarDate(value: Date | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

export function assertEffectiveDateWindow(input: {
  startDate: Date;
  effectiveDate: Date;
  reason?: string;
}) {
  const start = calendarDay(input.startDate);
  const effective = calendarDay(input.effectiveDate);
  const today = calendarDay(new Date());

  if (
    effective.getTime() < start.getTime() ||
    effective.getTime() > today.getTime()
  ) {
    throw new DomainConflictException(
      ASSET_ERROR_CODES.ASSET_DATE_RANGE_INVALID,
      input.reason ?? 'Effective date is outside the allowed window',
    );
  }
}

function calendarDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
