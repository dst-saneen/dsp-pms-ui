import { resolveConfiguredS3Endpoint } from './storage-s3.config';

describe('resolveConfiguredS3Endpoint', () => {
  it('ignores missing and invalid endpoints', () => {
    expect(resolveConfiguredS3Endpoint(undefined)).toBeUndefined();
    expect(resolveConfiguredS3Endpoint('not-a-url')).toBeUndefined();
  });

  it('accepts a valid STORAGE_S3_ENDPOINT', () => {
    expect(
      resolveConfiguredS3Endpoint('https://s3.ap-south-1.amazonaws.com'),
    ).toBe('https://s3.ap-south-1.amazonaws.com');
  });
});
