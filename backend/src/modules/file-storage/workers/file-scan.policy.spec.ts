import { shouldProcessFileScans } from './file-scan.policy';

describe('shouldProcessFileScans', () => {
  it('runs when the dedicated scan worker is enabled', () => {
    expect(shouldProcessFileScans(true, 'production')).toBe(true);
  });

  it('runs in non-production even when the scan worker is off', () => {
    expect(shouldProcessFileScans(false, 'development')).toBe(true);
    expect(shouldProcessFileScans(false, 'test')).toBe(true);
  });

  it('stays fail-closed in production when the scan worker is off', () => {
    expect(shouldProcessFileScans(false, 'production')).toBe(false);
  });
});
