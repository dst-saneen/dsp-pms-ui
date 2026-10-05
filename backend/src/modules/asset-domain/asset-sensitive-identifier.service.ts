import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

import { ASSET_ERROR_CODES } from './policies/asset-error-codes';
import type { Environment } from '../../config';

export const ASSET_CARD_LOOKUP_KEY_VERSION = 'v1';
export const ASSET_CARD_ENCRYPTION_FORMAT_VERSION = 1;
export const ASSET_CARD_KEK_VERSION = 'v1';

export interface EncryptedCardIdentifier {
  cardNumberCiphertext: Buffer;
  encryptionNonce: Buffer;
  encryptionAuthTag: Buffer;
  wrappedDataKey: Buffer;
  maskedCardNumber: string;
  keyEncryptionKeyVersion: string;
  encryptionFormatVersion: number;
  lookupKeyVersion: string;
  digest: string;
}

@Injectable()
export class AssetSensitiveIdentifierService {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  encryptCardNumber(cardNumber: string): EncryptedCardIdentifier {
    const normalized = this.normalizeCardNumber(cardNumber);
    if (!normalized) {
      throw new HttpException(
        {
          statusCode: 400,
          code: ASSET_ERROR_CODES.ASSET_IDENTIFIER_FORMAT_INVALID,
          message: 'Card number is invalid',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const kek = this.resolveKek();
    const dek = randomBytes(32);
    const payloadNonce = randomBytes(12);
    const payloadCipher = createCipheriv('aes-256-gcm', dek, payloadNonce);
    const ciphertext = Buffer.concat([
      payloadCipher.update(normalized, 'utf8'),
      payloadCipher.final(),
    ]);
    const payloadTag = payloadCipher.getAuthTag();

    const wrapNonce = randomBytes(12);
    const wrapCipher = createCipheriv('aes-256-gcm', kek, wrapNonce);
    const wrappedDek = Buffer.concat([
      wrapCipher.update(dek),
      wrapCipher.final(),
    ]);
    const wrapTag = wrapCipher.getAuthTag();

    return {
      cardNumberCiphertext: ciphertext,
      encryptionNonce: payloadNonce,
      encryptionAuthTag: payloadTag,
      wrappedDataKey: Buffer.concat([wrapNonce, wrapTag, wrappedDek]),
      maskedCardNumber: this.maskCardNumber(normalized),
      keyEncryptionKeyVersion: ASSET_CARD_KEK_VERSION,
      encryptionFormatVersion: ASSET_CARD_ENCRYPTION_FORMAT_VERSION,
      lookupKeyVersion: ASSET_CARD_LOOKUP_KEY_VERSION,
      digest: this.digestForNormalized(normalized, kek),
    };
  }

  lookupDigest(cardNumber: string): {
    lookupKeyVersion: string;
    digest: string;
  } {
    const normalized = this.normalizeCardNumber(cardNumber);
    if (!normalized) {
      throw new HttpException(
        {
          statusCode: 400,
          code: ASSET_ERROR_CODES.ASSET_IDENTIFIER_FORMAT_INVALID,
          message: 'Card number is invalid',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      lookupKeyVersion: ASSET_CARD_LOOKUP_KEY_VERSION,
      digest: this.digestForNormalized(normalized, this.resolveKek()),
    };
  }

  normalizeCardNumber(cardNumber: string): string | null {
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 4 || digits.length > 19) {
      return null;
    }

    return digits;
  }

  maskCardNumber(normalized: string): string {
    const lastFour = normalized.slice(-4);
    return `${'*'.repeat(Math.max(normalized.length - 4, 4))}${lastFour}`;
  }

  /** Unwrap is reserved for explicit format-migration commands; never used on read. */
  unwrapForMigration(envelope: EncryptedCardIdentifier): string {
    const kek = this.resolveKek();
    const wrapNonce = envelope.wrappedDataKey.subarray(0, 12);
    const wrapTag = envelope.wrappedDataKey.subarray(12, 28);
    const wrappedDek = envelope.wrappedDataKey.subarray(28);
    const wrapDecipher = createDecipheriv('aes-256-gcm', kek, wrapNonce);
    wrapDecipher.setAuthTag(wrapTag);
    const dek = Buffer.concat([
      wrapDecipher.update(wrappedDek),
      wrapDecipher.final(),
    ]);

    const payloadDecipher = createDecipheriv(
      'aes-256-gcm',
      dek,
      envelope.encryptionNonce,
    );
    payloadDecipher.setAuthTag(envelope.encryptionAuthTag);
    return Buffer.concat([
      payloadDecipher.update(envelope.cardNumberCiphertext),
      payloadDecipher.final(),
    ]).toString('utf8');
  }

  private digestForNormalized(normalized: string, kek: Buffer): string {
    return createHmac('sha256', kek)
      .update(`${ASSET_CARD_LOOKUP_KEY_VERSION}:${normalized}`)
      .digest('hex');
  }

  private resolveKek(): Buffer {
    const raw = this.config.get('ASSET_CARD_KEK', { infer: true })?.trim();
    if (!raw) {
      throw this.unavailable();
    }

    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }

    const fromBase64 = Buffer.from(raw, 'base64');
    if (fromBase64.length === 32) {
      return fromBase64;
    }

    throw this.unavailable();
  }

  private unavailable(): HttpException {
    return new HttpException(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: ASSET_ERROR_CODES.ASSET_SENSITIVE_STORAGE_UNAVAILABLE,
        message: 'Asset card storage is unavailable',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
