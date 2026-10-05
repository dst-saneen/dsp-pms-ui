import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { Environment } from '../../../config';
import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';

export const FINANCE_BANK_REFERENCE_FORMAT_VERSION = 1;

export interface FinanceBankReferenceAad {
  companyId: string;
  /** Prefer encrypting after the account id exists so AAD binds both ids. */
  accountId?: string;
}

export interface FinanceBankReferenceEnvelope {
  ciphertext: string;
  nonce: string;
  tag: string;
  keyVersion: string;
  formatVersion: number;
}

@Injectable()
export class FinanceBankReferenceEncryptionService {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  normalizeReference(plaintext: string): string {
    return plaintext.trim().replace(/\s+/g, ' ');
  }

  lastFour(normalizedReference: string): string {
    if (!normalizedReference) {
      return '';
    }
    return normalizedReference.slice(-4);
  }

  encrypt(
    plaintext: string,
    aad: FinanceBankReferenceAad,
  ): FinanceBankReferenceEnvelope {
    const keyVersion = this.config.get(
      'FINANCE_BANK_REFERENCE_ENC_ACTIVE_VERSION',
      { infer: true },
    );
    const key = this.requireKey(keyVersion);
    const aadBuffer = this.buildAad(aad);
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aadBuffer);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      nonce: nonce.toString('base64'),
      tag: tag.toString('base64'),
      keyVersion,
      formatVersion: FINANCE_BANK_REFERENCE_FORMAT_VERSION,
    };
  }

  decrypt(
    envelope: FinanceBankReferenceEnvelope,
    aad: FinanceBankReferenceAad,
  ): string {
    if (envelope.formatVersion !== FINANCE_BANK_REFERENCE_FORMAT_VERSION) {
      throw new ServiceUnavailableException({
        code: FINANCE_ERROR_CODES.FINANCE_BANK_KEY_UNAVAILABLE,
        message: 'Bank reference encryption format is not supported.',
      });
    }

    const key = this.requireKey(envelope.keyVersion);
    const aadBuffer = this.buildAad(aad);

    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(envelope.nonce, 'base64'),
      );
      decipher.setAAD(aadBuffer);
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new ServiceUnavailableException({
        code: FINANCE_ERROR_CODES.FINANCE_BANK_KEY_UNAVAILABLE,
        message: 'Bank reference could not be decrypted.',
      });
    }
  }

  private requireKey(keyVersion: string): Buffer {
    const keys = this.config.get('FINANCE_BANK_REFERENCE_ENC_KEYS', {
      infer: true,
    });
    const key = keys[keyVersion];

    if (!key) {
      throw new ServiceUnavailableException({
        code: FINANCE_ERROR_CODES.FINANCE_BANK_KEY_UNAVAILABLE,
        message: 'Bank reference encryption keys are not configured.',
      });
    }

    return key;
  }

  private buildAad(aad: FinanceBankReferenceAad): Buffer {
    const companyId = aad.companyId.trim();
    if (!companyId) {
      throw new ServiceUnavailableException({
        code: FINANCE_ERROR_CODES.FINANCE_BANK_KEY_UNAVAILABLE,
        message: 'Bank reference encryption AAD is incomplete.',
      });
    }

    const accountId = aad.accountId?.trim();
    if (accountId) {
      return Buffer.from(`${companyId}:${accountId}`, 'utf8');
    }

    // Create-before-id path: bind company only until the account id is known.
    return Buffer.from(companyId, 'utf8');
  }
}
