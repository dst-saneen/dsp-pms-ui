import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

export async function readLimitedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<Buffer> {
  const raw = (request as Request & { rawBody?: Buffer }).rawBody;
  if (Buffer.isBuffer(raw) && raw.length > 0) {
    if (raw.length > maxBytes) {
      throw new BadRequestException({ code: 'FILE_SIZE_MISMATCH' });
    }
    return raw;
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request as AsyncIterable<Uint8Array>) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      request.destroy();
      throw new BadRequestException({ code: 'FILE_SIZE_MISMATCH' });
    }
    chunks.push(buf);
  }

  return Buffer.concat(chunks, total);
}
