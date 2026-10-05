import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as net from 'net';
import { Readable } from 'stream';

import { Environment } from '../../../config';
import { S3StorageAdapter } from '../adapters/s3-storage.adapter';
import { hashReadableWithMagic } from './local-object-inspect';

export interface ScanResult {
  clean: boolean;
  infected: boolean;
  failed: boolean;
  virusName: string | null;
  engineVersion: string | null;
  signatureVersion: string | null;
  scannedAt: Date;
  rawResult: string;
  sha256Hex: string | null;
  magicBytes: Buffer | null;
  safeErrorCode: string | null;
}

@Injectable()
export class ClamAvScannerWorker implements OnModuleInit {
  private readonly logger = new Logger(ClamAvScannerWorker.name);
  private host: string;
  private port: number;
  private timeoutMs: number;
  private chunkSize: number;
  private maxStreamBytes: number;

  constructor(
    private readonly config: ConfigService<Environment, true>,
    private readonly storage: S3StorageAdapter,
  ) {}

  onModuleInit() {
    this.host = this.config.get('CLAMAV_HOST', { infer: true }) ?? '127.0.0.1';
    this.port = this.config.get('CLAMAV_PORT', { infer: true });
    this.timeoutMs = this.config.get('CLAMAV_TIMEOUT_MS', { infer: true });
    this.maxStreamBytes = this.config.get('CLAMAV_MAX_STREAM_BYTES', {
      infer: true,
    });
    this.chunkSize = 65_536;
  }

  async checkReadiness(): Promise<{
    healthy: boolean;
    version?: string;
    mode: 'clamav' | 'dev-fallback' | 'unavailable';
  }> {
    const clamAvHost = this.config.get('CLAMAV_HOST', { infer: true });
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });

    if (!clamAvHost) {
      if (nodeEnv === 'production') {
        return { healthy: false, mode: 'unavailable' };
      }
      // Matches scanObjectKey: empty host in non-prod uses clean fallback.
      return {
        healthy: true,
        version: 'dev-fallback',
        mode: 'dev-fallback',
      };
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(5000);

      socket.connect(this.port, this.host, () => {
        socket.write('zVERSION\0');
      });

      let data = '';
      socket.on('data', (chunk) => {
        data += chunk.toString();
        if (data.includes('\0') || data.includes('\n')) {
          socket.destroy();
          const version = data.split('/')[0]?.trim() ?? undefined;
          resolve({ healthy: true, version, mode: 'clamav' });
        }
      });

      socket.on('error', () =>
        resolve({ healthy: false, mode: 'unavailable' }),
      );
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ healthy: false, mode: 'unavailable' });
      });
    });
  }

  async scanObjectKey(objectKey: string): Promise<ScanResult> {
    const scannedAt = new Date();
    const clamAvHost = this.config.get('CLAMAV_HOST', { infer: true });
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });

    let objectStream: Readable;
    try {
      objectStream = await this.storage.getObjectStream(objectKey);
    } catch (err) {
      this.logger.error(
        `Failed to fetch object for scanning: ${objectKey}`,
        err,
      );
      return this.failedResult(scannedAt, 'S3_FETCH_FAILED');
    }

    if (!clamAvHost) {
      if (nodeEnv === 'production') {
        objectStream.destroy();
        return this.failedResult(scannedAt, 'CLAMAV_UNAVAILABLE');
      }

      try {
        const inspected = await hashReadableWithMagic(objectStream);
        this.logger.warn({
          event: 'file-storage.clamav.unconfigured',
          fallback: 'clean',
        });
        return {
          clean: true,
          infected: false,
          failed: false,
          virusName: null,
          engineVersion: 'dev-fallback',
          signatureVersion: 'dev-fallback',
          scannedAt,
          rawResult: 'stream: OK',
          sha256Hex: inspected.sha256Hex,
          magicBytes: inspected.magicBytes,
          safeErrorCode: null,
        };
      } catch (err) {
        this.logger.error(`Local scan inspect failed for ${objectKey}`, err);
        return this.failedResult(scannedAt, 'S3_FETCH_FAILED');
      }
    }

    try {
      return await this.streamToClamAv(objectStream, scannedAt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`ClamAV scan failed for ${objectKey}: ${message}`);
      const code = message.includes('timed out')
        ? 'CLAMAV_TIMEOUT'
        : message.includes('TOO_LARGE')
          ? 'FILE_SIZE_MISMATCH'
          : 'CLAMAV_STREAM_FAILED';
      return this.failedResult(scannedAt, code);
    }
  }

  private streamToClamAv(
    stream: Readable,
    scannedAt: Date,
  ): Promise<ScanResult> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      socket.setTimeout(this.timeoutMs);
      const hash = crypto.createHash('sha256');
      const magicChunks: Buffer[] = [];
      let magicLength = 0;
      let totalBytes = 0;

      socket.connect(this.port, this.host, () => {
        socket.write('zINSTREAM\0');
        stream.on('data', (chunk: Buffer) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buf.length;
          if (totalBytes > this.maxStreamBytes) {
            socket.destroy();
            stream.destroy();
            reject(new Error('CLAMAV_STREAM_TOO_LARGE'));
            return;
          }
          hash.update(buf);
          if (magicLength < 16) {
            magicChunks.push(buf);
            magicLength += buf.length;
          }
          for (let offset = 0; offset < buf.length; offset += this.chunkSize) {
            const slice = buf.subarray(offset, offset + this.chunkSize);
            const lengthBuf = Buffer.alloc(4);
            lengthBuf.writeUInt32BE(slice.length, 0);
            socket.write(lengthBuf);
            socket.write(slice);
          }
        });

        stream.on('end', () => {
          const endBuf = Buffer.alloc(4);
          endBuf.writeUInt32BE(0, 0);
          socket.write(endBuf);
        });

        stream.on('error', (err) => {
          socket.destroy();
          reject(err);
        });
      });

      let response = '';
      socket.on('data', (chunk) => {
        response += chunk.toString();
      });

      socket.on('end', () => {
        const parsed = this.parseResult(response.trim(), scannedAt);
        parsed.sha256Hex = hash.digest('hex');
        parsed.magicBytes = Buffer.concat(magicChunks).subarray(0, 16);
        resolve(parsed);
      });
      socket.on('error', reject);
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('ClamAV connection timed out'));
      });
    });
  }

  private parseResult(rawResult: string, scannedAt: Date): ScanResult {
    const clean = rawResult.endsWith('OK') || rawResult.includes(': OK');
    const infected =
      rawResult.includes('FOUND') && !rawResult.includes('stream: OK');

    let virusName: string | null = null;
    if (infected) {
      const match = rawResult.match(/stream: (.+) FOUND/);
      virusName = match?.[1] ?? 'UNKNOWN';
    }

    return {
      clean,
      infected,
      failed: !clean && !infected,
      virusName,
      engineVersion: null,
      signatureVersion: null,
      scannedAt,
      rawResult,
      sha256Hex: null,
      magicBytes: null,
      safeErrorCode: clean || infected ? null : 'CLAMAV_UNAVAILABLE',
    };
  }

  private failedResult(scannedAt: Date, code: string): ScanResult {
    return {
      clean: false,
      infected: false,
      failed: true,
      virusName: null,
      engineVersion: null,
      signatureVersion: null,
      scannedAt,
      rawResult: '',
      sha256Hex: null,
      magicBytes: null,
      safeErrorCode: code,
    };
  }
}
