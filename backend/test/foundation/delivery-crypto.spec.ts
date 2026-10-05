import { createHash, randomBytes } from 'node:crypto';

import { DeliveryCryptoService } from '../../src/modules/delivery/delivery-crypto.service';

function makeConfig(contentKey = randomBytes(32), hmacKey = randomBytes(32)) {
  const keys = { v1: contentKey };
  const hmacKeys = { v1: hmacKey };
  return {
    get: jest.fn((name: string) => {
      if (name === 'DELIVERY_CONTENT_ENCRYPTION_ACTIVE_VERSION') return 'v1';
      if (name === 'DELIVERY_CONTENT_ENCRYPTION_KEYS') return keys;
      if (name === 'DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION') return 'v1';
      if (name === 'DELIVERY_ADDRESS_HMAC_KEYS') return hmacKeys;
      return undefined;
    }),
  };
}

describe('DeliveryCryptoService (P0.7)', () => {
  it('round-trips sealed address and email content', () => {
    const crypto = new DeliveryCryptoService(makeConfig() as never);
    const context = {
      messageId: 'message-1',
      companyId: 'company-1',
      channel: 'EMAIL',
      templateKey: 'delivery.test',
      templateVersion: '1',
    } as const;

    const sealedAddress = crypto.sealAddress('Jane@Example.TEST', context);
    expect(sealedAddress.addressHmac).toHaveLength(64);
    expect(
      crypto.openAddress(
        {
          ciphertext: sealedAddress.ciphertext,
          nonce: sealedAddress.nonce,
          authTag: sealedAddress.authTag,
          keyVersion: sealedAddress.keyVersion,
        },
        context,
      ),
    ).toBe('jane@example.test');

    const sealedContent = crypto.sealEmailContent(
      {
        subject: 'Subject',
        bodyText: 'Text body',
        bodyHtml: '<p>HTML body</p>',
      },
      context,
    );
    const opened = crypto.openEmailContent({ ...context, ...sealedContent });
    expect(opened).toEqual({
      subject: 'Subject',
      bodyText: 'Text body',
      bodyHtml: '<p>HTML body</p>',
    });
  });

  it('rejects ciphertext bound to a different message or Company', () => {
    const crypto = new DeliveryCryptoService(makeConfig() as never);
    const context = {
      messageId: 'message-1',
      companyId: 'company-1',
      channel: 'EMAIL',
      templateKey: 'delivery.test',
      templateVersion: '1',
    } as const;
    const sealed = crypto.sealAddress('jane@example.test', context);
    expect(() =>
      crypto.openAddress(
        {
          ciphertext: sealed.ciphertext,
          nonce: sealed.nonce,
          authTag: sealed.authTag,
          keyVersion: sealed.keyVersion,
        },
        { ...context, companyId: 'company-2' },
      ),
    ).toThrow();
  });

  it('produces stable address HMACs for the same normalized address', () => {
    const hmacKey = createHash('sha256').update('hmac-test').digest();
    const crypto = new DeliveryCryptoService(
      makeConfig(randomBytes(32), hmacKey) as never,
    );
    expect(crypto.hmacAddress('User@Example.com')).toBe(
      crypto.hmacAddress('user@example.com'),
    );
  });
});
