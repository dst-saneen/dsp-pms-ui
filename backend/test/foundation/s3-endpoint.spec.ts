import { resolveS3Endpoint } from '../../src/modules/recruitment/document/s3-endpoint';

describe('resolveS3Endpoint', () => {
  it('ignores blank and invalid values', () => {
    expect(resolveS3Endpoint(undefined)).toBeUndefined();
    expect(resolveS3Endpoint('')).toBeUndefined();
    expect(resolveS3Endpoint('l')).toBeUndefined();
    expect(resolveS3Endpoint('not-a-url')).toBeUndefined();
  });

  it('keeps http(s) endpoints', () => {
    expect(resolveS3Endpoint('https://s3.ap-south-1.amazonaws.com')).toBe(
      'https://s3.ap-south-1.amazonaws.com',
    );
    expect(resolveS3Endpoint('http://127.0.0.1:9000')).toBe(
      'http://127.0.0.1:9000',
    );
  });
});
