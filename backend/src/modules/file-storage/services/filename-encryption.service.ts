import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { Environment } from '../../../config';

export interface EncryptedFilename {
  ciphertext: string;
  nonce: string;
  tag: string;
  keyVersion: string;
}

@Injectable()
export class FilenameEncryptionService {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  encrypt(filename: string): EncryptedFilename {
    const keyVersion = this.config.get('FILE_NAME_ENC_ACTIVE_KEY_VERSION', {
      infer: true,
    });
    const keys = this.config.get('FILE_NAME_ENC_KEYS', { infer: true });
    const key = keys[keyVersion];
    if (!key) {
      throw new ServiceUnavailableException({
        code: 'FILE_ENCRYPTION_NOT_CONFIGURED',
      });
    }

    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const encrypted = Buffer.concat([
      cipher.update(filename, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64'),
      nonce: nonce.toString('base64'),
      tag: tag.toString('base64'),
      keyVersion,
    };
  }

  decrypt(input: {
    ciphertext: string;
    nonce?: string | null;
    tag?: string | null;
    keyVersion: string;
  }): string | null {
    if (!input.nonce || !input.tag) {
      return null;
    }

    const accepted = this.config.get('FILE_NAME_ENC_ACCEPTED_KEY_VERSIONS', {
      infer: true,
    });
    if (!accepted.includes(input.keyVersion)) {
      return null;
    }

    const keys = this.config.get('FILE_NAME_ENC_KEYS', { infer: true });
    const key = keys[input.keyVersion];
    if (!key) {
      return null;
    }

    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(input.nonce, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(input.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(input.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return null;
    }
  }
}
