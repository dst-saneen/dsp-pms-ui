import {
  isSerializationFailure,
  withSerializationRetry,
} from './serialization-retry.helper';

describe('serialization retry helper', () => {
  it('detects Prisma serialization failures', () => {
    expect(isSerializationFailure({ code: 'P2034' })).toBe(true);
    expect(isSerializationFailure({ code: '40001' })).toBe(true);
    expect(isSerializationFailure({ message: 'deadlock detected' })).toBe(true);
    expect(isSerializationFailure({ code: 'P2002' })).toBe(false);
  });

  it('retries then succeeds', async () => {
    let attempts = 0;
    const result = await withSerializationRetry(() => {
      attempts += 1;
      if (attempts < 3) {
        throw Object.assign(new Error('could not serialize'), {
          code: 'P2034',
        });
      }
      return Promise.resolve('ok');
    });
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });
});
