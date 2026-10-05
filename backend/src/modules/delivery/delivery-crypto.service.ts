import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';

import { Environment } from '../../config';

export interface SealedField {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: string;
}

export interface SealedAddress extends SealedField {
  addressHmac: string;
  hmacKeyVersion: string;
}

export interface SealedEmailContent {
  subjectCiphertext: string;
  bodyTextCiphertext: string;
  bodyHtmlCiphertext: string;
  contentNonce: string;
  contentAuthTag: string;
  contentKeyVersion: string;
}

export interface DeliveryEncryptionContext {
  messageId: string;
  companyId: string | null | undefined;
  channel: string;
  templateKey: string | null | undefined;
  templateVersion: string | null | undefined;
}

export interface OpenedEmailContent {
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

/**
 * Delivery content encryption and address HMAC.
 *
 * Subject/body fields use a packed ciphertext (nonce||tag||ct) so each
 * column is independently decryptable while contentNonce/contentAuthTag
 * mirror the body-text seal for schema compatibility. New envelopes are
 * marked `v2:` and authenticated with message/tenant AAD; unmarked rows are
 * earlier-envelope read compatibility and must be re-encrypted by the backfill.
 */
@Injectable()
export class DeliveryCryptoService {
  constructor(
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  isReady(): boolean {
    try {
      this.activeContentKey();
      this.activeAddressHmacKey();
      return true;
    } catch {
      return false;
    }
  }

  sealAddress(
    address: string,
    context: DeliveryEncryptionContext,
  ): SealedAddress {
    const normalized = address.trim().toLowerCase();
    const sealed = this.sealPlaintext(
      normalized,
      this.activeContentKey(),
      this.addressAad(context),
    );
    return {
      ...sealed,
      addressHmac: this.hmacAddress(normalized),
      hmacKeyVersion: this.configService.get(
        'DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION',
        { infer: true },
      ),
    };
  }

  openAddress(
    input: {
      ciphertext: string;
      nonce: string;
      authTag: string;
      keyVersion: string;
    },
    context: DeliveryEncryptionContext,
  ): string {
    return this.openPlaintext(input, this.addressAad(context));
  }

  hmacAddress(address: string): string {
    const normalized = address.trim().toLowerCase();
    const { key } = this.activeAddressHmacKey();
    return createHmac('sha256', key).update(normalized).digest('hex');
  }

  /** Seal arbitrary UTF-8 text (e.g. webhook provider payloads). */
  sealOpaque(plaintext: string, aad: string): SealedField {
    return this.sealPlaintext(plaintext, this.activeContentKey(), aad);
  }

  sealEmailContent(
    input: {
      subject: string;
      bodyText: string;
      bodyHtml: string;
    },
    context: DeliveryEncryptionContext,
  ): SealedEmailContent {
    const { key, version } = this.activeContentKey();
    const aad = this.contentAad(context);
    const subject = this.sealPlaintext(input.subject, { key, version }, aad);
    const bodyText = this.sealPlaintext(input.bodyText, { key, version }, aad);
    const bodyHtml = this.sealPlaintext(input.bodyHtml, { key, version }, aad);

    return {
      subjectCiphertext: this.packSealed(subject),
      bodyTextCiphertext: this.packSealed(bodyText),
      bodyHtmlCiphertext: this.packSealed(bodyHtml),
      contentNonce: bodyText.nonce,
      contentAuthTag: bodyText.authTag,
      contentKeyVersion: version,
    };
  }

  openEmailContent(message: {
    /** `id` is the persisted DeliveryMessage identifier. */
    id?: string;
    /** Backward-compatible input used by encryption callers and tests. */
    messageId?: string;
    companyId?: string | null;
    channel: string;
    templateKey?: string | null;
    templateVersion?: string | null;
    subjectCiphertext?: string | null;
    bodyTextCiphertext?: string | null;
    bodyHtmlCiphertext?: string | null;
    contentKeyVersion?: string | null;
  }): OpenedEmailContent | null {
    if (
      !message.subjectCiphertext ||
      !message.bodyTextCiphertext ||
      !message.bodyHtmlCiphertext
    ) {
      return null;
    }

    const messageId = message.messageId ?? message.id;
    if (!messageId) {
      throw new Error('DELIVERY_CONTENT_CONTEXT_MISSING');
    }

    const context: DeliveryEncryptionContext = {
      messageId,
      companyId: message.companyId,
      channel: message.channel,
      templateKey: message.templateKey,
      templateVersion: message.templateVersion,
    };

    return {
      subject: this.openPacked(
        message.subjectCiphertext,
        message.contentKeyVersion,
        this.contentAad(context),
      ),
      bodyText: this.openPacked(
        message.bodyTextCiphertext,
        message.contentKeyVersion,
        this.contentAad(context),
      ),
      bodyHtml: this.openPacked(
        message.bodyHtmlCiphertext,
        message.contentKeyVersion,
        this.contentAad(context),
      ),
    };
  }

  private sealPlaintext(
    plaintext: string,
    keyRef: { key: Buffer; version: string },
    aad: string,
  ): SealedField {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', keyRef.key, nonce);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: `v2:${encrypted.toString('base64')}`,
      nonce: nonce.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion: keyRef.version,
    };
  }

  private openPlaintext(
    input: {
      ciphertext: string;
      nonce: string;
      authTag: string;
      keyVersion: string;
    },
    aad: string,
  ): string {
    const key = this.contentKey(input.keyVersion);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(input.nonce, 'base64'),
    );
    const isV2 = input.ciphertext.startsWith('v2:');
    if (isV2) {
      decipher.setAAD(Buffer.from(aad, 'utf8'));
    }
    decipher.setAuthTag(Buffer.from(input.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(
        Buffer.from(
          isV2 ? input.ciphertext.slice('v2:'.length) : input.ciphertext,
          'base64',
        ),
      ),
      decipher.final(),
    ]).toString('utf8');
  }

  private packSealed(sealed: SealedField): string {
    return `v2:${Buffer.concat([
      Buffer.from(sealed.nonce, 'base64'),
      Buffer.from(sealed.authTag, 'base64'),
      Buffer.from(sealed.ciphertext.slice('v2:'.length), 'base64'),
    ]).toString('base64')}`;
  }

  private openPacked(
    packed: string,
    keyVersion: string | null | undefined,
    aad: string,
  ): string {
    const isV2 = packed.startsWith('v2:');
    const raw = Buffer.from(
      isV2 ? packed.slice('v2:'.length) : packed,
      'base64',
    );
    if (raw.length < 28) {
      throw new Error('DELIVERY_CONTENT_CORRUPT');
    }
    const nonce = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const version =
      keyVersion ??
      this.configService.get('DELIVERY_CONTENT_ENCRYPTION_ACTIVE_VERSION', {
        infer: true,
      }) ??
      'v1';
    return this.openPlaintext(
      {
        ciphertext: `${isV2 ? 'v2:' : ''}${ciphertext.toString('base64')}`,
        nonce: nonce.toString('base64'),
        authTag: authTag.toString('base64'),
        keyVersion: version,
      },
      aad,
    );
  }

  private contentAad(context: DeliveryEncryptionContext): string {
    return [
      'delivery-message:v2',
      context.messageId,
      context.companyId ?? '',
      context.channel,
      context.templateKey ?? '',
      context.templateVersion ?? '',
    ].join('|');
  }

  private addressAad(context: DeliveryEncryptionContext): string {
    return [
      'delivery-recipient:v2',
      context.messageId,
      context.companyId ?? '',
      context.channel,
    ].join('|');
  }

  private activeContentKey(): { key: Buffer; version: string } {
    const version =
      this.configService.get('DELIVERY_CONTENT_ENCRYPTION_ACTIVE_VERSION', {
        infer: true,
      }) ?? 'v1';
    return { key: this.contentKey(version), version };
  }

  private contentKey(version: string): Buffer {
    const keys = this.configService.get('DELIVERY_CONTENT_ENCRYPTION_KEYS', {
      infer: true,
    });
    const key = keys[version];
    if (!key) {
      throw new Error(`DELIVERY_CONTENT_KEY_MISSING:${version}`);
    }
    return key;
  }

  private activeAddressHmacKey(): { key: Buffer; version: string } {
    const version =
      this.configService.get('DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION', {
        infer: true,
      }) ?? 'v1';
    const keys = this.configService.get('DELIVERY_ADDRESS_HMAC_KEYS', {
      infer: true,
    });
    const key = keys[version];
    if (!key) {
      throw new Error(`DELIVERY_ADDRESS_HMAC_KEY_MISSING:${version}`);
    }
    return { key, version };
  }
}
