import { AssetCapabilityService } from '../../src/modules/asset-domain/asset-capability.service';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';
import type { AssetAccessContext } from '../../src/modules/asset-domain/asset-access.types';

describe('AssetCapabilityService transfer and waiver actions', () => {
  const service = new AssetCapabilityService();

  const destinationCustodian: AssetAccessContext = {
    userId: 'custodian-2',
    permissions: [ASSET_PERMISSIONS.DEPARTMENT_READ],
  };

  const requester: AssetAccessContext = {
    userId: 'requester-1',
    permissions: [ASSET_PERMISSIONS.DEPARTMENT_MANAGE],
  };

  const hrApprover: AssetAccessContext = {
    userId: 'hr-1',
    permissions: [ASSET_PERMISSIONS.CLEARANCE_WAIVE],
  };

  it('allows destination custodians to accept or reject pending transfers', () => {
    const actions = service.getTransferAllowedActions(
      {
        status: 'PENDING',
        requestedByUserId: 'requester-1',
        fromDepartmentId: 'dept-a',
        toDepartmentId: 'dept-b',
      },
      destinationCustodian,
      ['dept-b'],
    );

    expect(actions).toEqual(expect.arrayContaining(['ACCEPT', 'REJECT']));
    expect(actions).not.toContain('CANCEL');
  });

  it('allows the requester to cancel a pending transfer', () => {
    const actions = service.getTransferAllowedActions(
      {
        status: 'PENDING',
        requestedByUserId: 'requester-1',
        fromDepartmentId: 'dept-a',
        toDepartmentId: 'dept-b',
      },
      requester,
      ['dept-a'],
    );

    expect(actions).toContain('CANCEL');
  });

  it('prevents waiver self-approval and exposes cancel to requester', () => {
    expect(
      service.getWaiverAllowedActions(
        { status: 'REQUESTED', requestedByUserId: 'requester-1' },
        requester,
      ),
    ).toEqual(['CANCEL']);

    expect(
      service.getWaiverAllowedActions(
        { status: 'REQUESTED', requestedByUserId: 'requester-1' },
        hrApprover,
      ),
    ).toEqual(['APPROVE', 'REJECT']);
  });
});
