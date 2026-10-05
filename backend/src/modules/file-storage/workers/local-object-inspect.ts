import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

export async function hashReadableWithMagic(
  stream: Readable,
  magicLength = 16,
): Promise<{ sha256Hex: string; magicBytes: Buffer }> {
  const hash = createHash('sha256');
  const chunks: Buffer[] = [];
  let captured = 0;

  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    hash.update(buf);
    if (captured < magicLength) {
      chunks.push(buf);
      captured += buf.length;
    }
  }

  return {
    sha256Hex: hash.digest('hex'),
    magicBytes: Buffer.concat(chunks).subarray(0, magicLength),
  };
}
