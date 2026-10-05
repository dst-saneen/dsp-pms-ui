import { splitOwnerDisplayName } from '../../src/modules/organization-onboarding/owner-founding-employee';

describe('splitOwnerDisplayName', () => {
  it('splits a full owner display name', () => {
    expect(
      splitOwnerDisplayName('Owner Atlas UAT-E2E-20260903-01', 'owner'),
    ).toEqual({
      firstName: 'Owner',
      lastName: 'Atlas UAT-E2E-20260903-01',
    });
  });

  it('uses username when display name is empty', () => {
    expect(splitOwnerDisplayName('  ', 'atlas.owner')).toEqual({
      firstName: 'atlas.owner',
      lastName: null,
    });
  });

  it('falls back to Organization Owner', () => {
    expect(splitOwnerDisplayName(null, null)).toEqual({
      firstName: 'Organization',
      lastName: 'Owner',
    });
  });
});
