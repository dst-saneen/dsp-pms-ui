import { AssetSelfServiceQueryService } from '../../src/modules/asset-domain/asset-self-service-query.service';

describe('AssetSelfServiceQueryService', () => {
  const capabilities = {
    getEmployeeAssetAllowedActions: jest
      .fn()
      .mockReturnValue(['ACKNOWLEDGE', 'REQUEST_RETURN']),
    getLicenseAllocationAllowedActions: jest
      .fn()
      .mockReturnValue(['ACKNOWLEDGE']),
  };
  const mapper = {
    toEmployeeAssetResponse: jest.fn(
      (
        assignment: { id: string; acknowledgedAt: Date | null },
        actions: string[],
      ) => ({
        id: assignment.id,
        acknowledgedAt: assignment.acknowledgedAt,
        allowedActions: actions,
      }),
    ),
    toLicenseAllocationResponse: jest.fn(
      (
        allocation: { id: string; acknowledgedAt: Date | null },
        actions: string[],
      ) => ({
        id: allocation.id,
        acknowledgedAt: allocation.acknowledgedAt,
        allowedActions: actions,
      }),
    ),
  };

  const prisma = {
    employeeAsset: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'ea-1', acknowledgedAt: null },
        { id: 'ea-2', acknowledgedAt: new Date() },
      ]),
    },
    softwareLicenseAllocation: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'la-1', acknowledgedAt: null }]),
    },
    assetCustodyRequest: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'request-1',
          requestType: 'RETURN',
          status: 'SUBMITTED',
          requestedAt: new Date('2026-09-22T00:00:00.000Z'),
          employeeAssetId: 'ea-1',
          licenseAllocationId: null,
        },
      ]),
    },
  };

  function createService() {
    return new AssetSelfServiceQueryService(
      prisma as never,
      capabilities as never,
      mapper as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns MyAssetsResponse with summary counts and allowedActions', async () => {
    const service = createService();

    const result = await service.findMyAssets('employee-1');

    expect(result.summary).toEqual({
      physicalAssigned: 2,
      activeLicenses: 1,
      acknowledgementPending: 2,
      openRequests: 1,
    });
    expect(result.physicalAssignments).toHaveLength(2);
    expect(result.licenseAllocations).toHaveLength(1);
    expect(result.physicalAssignments[0].pendingRequest).toEqual({
      id: 'request-1',
      requestType: 'RETURN',
      status: 'SUBMITTED',
      requestedAt: '2026-09-22T00:00:00.000Z',
    });
    expect(capabilities.getEmployeeAssetAllowedActions).toHaveBeenCalledWith(
      expect.anything(),
      { isSelfService: true, hasOpenRequest: true },
    );
  });
});
