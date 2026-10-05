import {
  AssetKind,
  AssetLifecycleStatus,
  AssetTrackingMode,
} from '@prisma/client';

import {
  ASSET_LIFECYCLE_COMMAND,
  isAllowedLifecycleTransition,
  isTerminalLifecycleStatus,
  resolveLifecycleTransition,
} from '../../src/modules/asset-domain/policies/asset-lifecycle-transitions';
import { ASSET_ERROR_CODES } from '../../src/modules/asset-domain/policies/asset-error-codes';

describe('Asset lifecycle transition matrix (§4.15)', () => {
  const baseContext = {
    kind: AssetKind.HARDWARE,
    hasOpenCustody: false,
    hasOpenRequest: false,
    hasActiveAllocations: false,
    isAssignedIndividual: false,
    repairDetailsPresent: true,
  };

  it('allows ACTIVE -> IN_REPAIR for location assets without open custody', () => {
    expect(
      resolveLifecycleTransition(
        AssetLifecycleStatus.ACTIVE,
        ASSET_LIFECYCLE_COMMAND.SEND_TO_REPAIR,
        {
          ...baseContext,
          trackingMode: AssetTrackingMode.LOCATION,
        },
      ),
    ).toBe(AssetLifecycleStatus.IN_REPAIR);
  });

  it('blocks repair when open custody exists', () => {
    expect(
      isAllowedLifecycleTransition(
        AssetLifecycleStatus.ACTIVE,
        ASSET_LIFECYCLE_COMMAND.SEND_TO_REPAIR,
        {
          ...baseContext,
          trackingMode: AssetTrackingMode.INDIVIDUAL,
          hasOpenCustody: true,
        },
      ),
    ).toBe(false);
  });

  it('allows IN_REPAIR -> ACTIVE when repair details are present', () => {
    expect(
      resolveLifecycleTransition(
        AssetLifecycleStatus.IN_REPAIR,
        ASSET_LIFECYCLE_COMMAND.COMPLETE_REPAIR,
        {
          ...baseContext,
          trackingMode: AssetTrackingMode.INDIVIDUAL,
        },
      ),
    ).toBe(AssetLifecycleStatus.ACTIVE);
  });

  it('allows individual custody closure to LOST in same transaction context', () => {
    expect(
      resolveLifecycleTransition(
        AssetLifecycleStatus.ACTIVE,
        ASSET_LIFECYCLE_COMMAND.CLOSE_CUSTODY_AS_LOST,
        {
          ...baseContext,
          trackingMode: AssetTrackingMode.INDIVIDUAL,
          hasOpenCustody: true,
        },
      ),
    ).toBe(AssetLifecycleStatus.LOST);
  });

  it('allows LOST -> DISPOSED write-off path', () => {
    expect(
      resolveLifecycleTransition(
        AssetLifecycleStatus.LOST,
        ASSET_LIFECYCLE_COMMAND.DISPOSE,
        {
          ...baseContext,
          trackingMode: AssetTrackingMode.LOCATION,
        },
      ),
    ).toBe(AssetLifecycleStatus.DISPOSED);
  });

  it('allows pool suspend and resume', () => {
    expect(
      resolveLifecycleTransition(
        AssetLifecycleStatus.ACTIVE,
        ASSET_LIFECYCLE_COMMAND.SUSPEND,
        {
          ...baseContext,
          trackingMode: AssetTrackingMode.POOL,
          kind: AssetKind.SOFTWARE_LICENSE,
        },
      ),
    ).toBe(AssetLifecycleStatus.SUSPENDED);

    expect(
      resolveLifecycleTransition(
        AssetLifecycleStatus.SUSPENDED,
        ASSET_LIFECYCLE_COMMAND.RESUME,
        {
          ...baseContext,
          trackingMode: AssetTrackingMode.POOL,
          kind: AssetKind.SOFTWARE_LICENSE,
        },
      ),
    ).toBe(AssetLifecycleStatus.ACTIVE);
  });

  it('blocks pool retire while active allocations exist', () => {
    expect(
      isAllowedLifecycleTransition(
        AssetLifecycleStatus.ACTIVE,
        ASSET_LIFECYCLE_COMMAND.RETIRE,
        {
          ...baseContext,
          trackingMode: AssetTrackingMode.POOL,
          kind: AssetKind.SOFTWARE_LICENSE,
          hasActiveAllocations: true,
        },
      ),
    ).toBe(false);
  });

  it('treats DISPOSED and RETIRED as terminal', () => {
    expect(isTerminalLifecycleStatus(AssetLifecycleStatus.DISPOSED)).toBe(true);
    expect(isTerminalLifecycleStatus(AssetLifecycleStatus.RETIRED)).toBe(true);
    expect(isTerminalLifecycleStatus(AssetLifecycleStatus.ACTIVE)).toBe(false);
  });

  it('returns null for transitions outside the matrix', () => {
    expect(
      resolveLifecycleTransition(
        AssetLifecycleStatus.DISPOSED,
        ASSET_LIFECYCLE_COMMAND.RESUME,
        {
          ...baseContext,
          trackingMode: AssetTrackingMode.POOL,
        },
      ),
    ).toBeNull();
  });
});

describe('Asset error codes catalog (§11)', () => {
  it('includes employee eligibility and invalid transition codes', () => {
    expect(ASSET_ERROR_CODES.EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET).toBe(
      'EMPLOYEE_NOT_ELIGIBLE_FOR_ASSET',
    );
    expect(ASSET_ERROR_CODES.ASSET_INVALID_STATE_TRANSITION).toBe(
      'ASSET_INVALID_STATE_TRANSITION',
    );
  });
});
