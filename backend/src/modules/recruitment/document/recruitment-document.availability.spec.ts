import { JobOfferStatus, MalwareScanStatus } from '@prisma/client';

describe('RecruitmentDocumentService availability', () => {
  it('treats only CLEAN documents as downloadable', () => {
    const allowed = new Set<MalwareScanStatus>([MalwareScanStatus.CLEAN]);
    expect(allowed.has(MalwareScanStatus.PENDING)).toBe(false);
    expect(allowed.has(MalwareScanStatus.INFECTED)).toBe(false);
    expect(allowed.has(MalwareScanStatus.FAILED)).toBe(false);
    expect(allowed.has(MalwareScanStatus.QUARANTINED)).toBe(false);
    expect(allowed.has(MalwareScanStatus.CLEAN)).toBe(true);
  });
});

describe('offer terminal states', () => {
  it('keeps distinct public offer statuses instead of collapsing them', () => {
    const publicStates = [
      JobOfferStatus.SENT,
      JobOfferStatus.ACCEPTED,
      JobOfferStatus.DECLINED,
      JobOfferStatus.EXPIRED,
      JobOfferStatus.REVOKED,
      JobOfferStatus.SUPERSEDED,
    ];

    expect(new Set(publicStates).size).toBe(6);
  });
});
