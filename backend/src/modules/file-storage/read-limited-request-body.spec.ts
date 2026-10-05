import { Readable } from 'node:stream';

import { BadRequestException } from '@nestjs/common';

import { readLimitedRequestBody } from './read-limited-request-body';

describe('readLimitedRequestBody', () => {
  it('reads a stream within the limit', async () => {
    const request = Readable.from([
      Buffer.from('abc'),
      Buffer.from('def'),
    ]) as never;
    await expect(readLimitedRequestBody(request, 10)).resolves.toEqual(
      Buffer.from('abcdef'),
    );
  });

  it('rejects a stream over the limit', async () => {
    const request = Readable.from([Buffer.from('abcdefghij')]) as never;
    await expect(readLimitedRequestBody(request, 4)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
