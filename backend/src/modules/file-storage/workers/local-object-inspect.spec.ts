import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';

import { hashReadableWithMagic } from './local-object-inspect';

describe('hashReadableWithMagic', () => {
  it('hashes the full stream and keeps leading magic bytes', async () => {
    const body = Buffer.from('%PDF-1.4 rest of the file');
    const stream = Readable.from([body.subarray(0, 4), body.subarray(4)]);

    const result = await hashReadableWithMagic(stream);

    expect(result.sha256Hex).toBe(
      createHash('sha256').update(body).digest('hex'),
    );
    expect(result.magicBytes.equals(body.subarray(0, 16))).toBe(true);
  });
});
