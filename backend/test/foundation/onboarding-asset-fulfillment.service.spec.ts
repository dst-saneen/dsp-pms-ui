import {
  AssetKind,
  AssetLifecycleStatus,
  AssetTrackingMode,
  OnboardingTaskResultType,
} from '@prisma/client';

import { OnboardingAssetFulfillmentService } from '../../src/modules/onboarding-runtime/services/onboarding-asset-fulfillment.service';
import { ASSET_PERMISSIONS } from '../../src/modules/asset-domain/policies/asset-permissions';

describe('OnboardingAssetFulfillmentService', () => {
  const user = {
    id: 'user-1',
    username: 'asset-custodian',
    employeeId: 'executor-1',
    mustChangePassword: false,
    sessionId: 'session-1',
    authorization: {
      roles: [],
      permissions: [ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_MANAGE],
      scopeLevel: 'BRANCH',
      isGlobal: false,
      activeCompanyId: 'company-1',
      activeBranchId: 'branch-1',
      availableScopes: [],
    },
  } as const;
  const task = {
    id: 'task-1',
    attemptNo: 2,
    companyId: 'company-1',
    branchId: 'branch-1',
    employeeId: 'employee-1',
    workType: 'ASSET',
    referenceType: 'ASSET_TYPE',
    referenceId: 'asset-type-1',
  };

  function createService(asset: Record<string, unknown>) {
    const access = {
      canManageCustody: jest.fn().mockReturnValue(true),
      buildCustodyAssetWhere: jest
        .fn()
        .mockResolvedValue({ departmentId: { in: ['dept-1'] } }),
    };
    const featureGate = {
      assertEnabledForCompany: jest.fn().mockResolvedValue(undefined),
    };
    const custody = {
      assignWithinTransaction: jest
        .fn()
        .mockResolvedValue({ id: 'employee-asset-1' }),
    };
    const licenses = {
      allocateWithinTransaction: jest
        .fn()
        .mockResolvedValue({ id: 'allocation-1' }),
    };
    const prisma = {
      asset: { findFirst: jest.fn().mockResolvedValue(asset) },
    };
    const service = new OnboardingAssetFulfillmentService(
      prisma as never,
      access as never,
      featureGate as never,
      custody as never,
      licenses as never,
    );

    return { service, access, featureGate, custody, licenses, prisma };
  }

  it('requires the Asset grant for the task executor Department', () => {
    const { service } = createService({});
    const actor = {
      userId: 'user-1',
      isGlobal: false,
      permissions: [ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_MANAGE],
      assetGrantedDepartmentIds: ['dept-other'],
      organizationContext: {},
      employeeContext: null,
      roleAssignments: [],
    };

    expect(
      service.isAvailable(actor, {
        companyId: 'company-1',
        branchId: 'branch-1',
        departmentId: 'dept-1',
      }),
    ).toBe(false);

    actor.assetGrantedDepartmentIds = ['dept-1'];
    expect(
      service.isAvailable(actor, {
        companyId: 'company-1',
        branchId: 'branch-1',
        departmentId: 'dept-1',
      }),
    ).toBe(true);
  });

  it('creates source-bound physical custody inside the caller transaction', async () => {
    const asset = {
      id: 'asset-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      assetCode: 'LAP-001',
      assetName: 'Laptop',
      trackingMode: AssetTrackingMode.INDIVIDUAL,
      kind: AssetKind.HARDWARE,
      lifecycleStatus: AssetLifecycleStatus.ACTIVE,
      softwareLicenseDetail: null,
    };
    const { service, custody, licenses, prisma } = createService(asset);
    const tx = { asset: prisma.asset };

    await expect(
      service.fulfillWithinTransaction(tx as never, user as never, task, {
        assetId: 'asset-1',
        expectedAssetVersion: 4,
        effectiveDate: '2026-08-19',
      }),
    ).resolves.toEqual({
      resultType: OnboardingTaskResultType.EMPLOYEE_ASSET,
      employeeAssetId: 'employee-asset-1',
      softwareLicenseAllocationId: null,
      assetId: 'asset-1',
      safeAssetLabel: 'LAP-001 - Laptop',
    });

    expect(custody.assignWithinTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        employeeId: 'employee-1',
        sourceType: 'ONBOARDING_TASK',
        sourceId: 'task-1',
        sourceCommandKey: 'onboarding-task:task-1:attempt:2',
        expectedAssetVersion: 4,
      }),
    );
    expect(licenses.allocateWithinTransaction).not.toHaveBeenCalled();
  });

  it('creates a source-bound pool allocation for an entitled Company', async () => {
    const asset = {
      id: 'pool-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      assetCode: 'LIC-001',
      assetName: 'Developer licence',
      trackingMode: AssetTrackingMode.POOL,
      kind: AssetKind.SOFTWARE_LICENSE,
      lifecycleStatus: AssetLifecycleStatus.ACTIVE,
      softwareLicenseDetail: { seatCapacity: 10, allocatedSeatCount: 2 },
    };
    const { service, custody, licenses, featureGate, prisma } =
      createService(asset);
    const tx = { asset: prisma.asset };

    await expect(
      service.fulfillWithinTransaction(tx as never, user as never, task, {
        assetId: 'pool-1',
        expectedAssetVersion: 7,
        effectiveDate: '2026-08-19',
      }),
    ).resolves.toMatchObject({
      resultType: OnboardingTaskResultType.SOFTWARE_LICENSE_ALLOCATION,
      softwareLicenseAllocationId: 'allocation-1',
      employeeAssetId: null,
    });

    expect(featureGate.assertEnabledForCompany).toHaveBeenCalledWith(
      'company-1',
    );
    expect(licenses.allocateWithinTransaction).toHaveBeenCalledWith(
      tx,
      'pool-1',
      expect.objectContaining({
        sourceType: 'ONBOARDING_TASK',
        sourceCommandKey: 'onboarding-task:task-1:attempt:2',
      }),
    );
    expect(custody.assignWithinTransaction).not.toHaveBeenCalled();
  });
});
