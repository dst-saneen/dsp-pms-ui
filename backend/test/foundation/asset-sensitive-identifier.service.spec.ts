import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../src/config';
import { AssetSensitiveIdentifierService } from '../../src/modules/asset-domain/asset-sensitive-identifier.service';

describe('AssetSensitiveIdentifierService', () => {
  it('masks and digests card numbers without exposing plaintext on the envelope', () => {
    const config = new ConfigService<Environment, true>({
      ASSET_CARD_KEK: '0'.repeat(64),
    } as Environment);
    const service = new AssetSensitiveIdentifierService(config);
    const envelope = service.encryptCardNumber('4111 1111 1111 1111');

    expect(envelope.maskedCardNumber.endsWith('1111')).toBe(true);
    expect(envelope.maskedCardNumber.includes('4111')).toBe(false);
    expect(envelope.digest).toHaveLength(64);
    expect(
      envelope.cardNumberCiphertext.equals(Buffer.from('4111111111111111')),
    ).toBe(false);

    const lookup = service.lookupDigest('4111111111111111');
    expect(lookup.digest).toBe(envelope.digest);
  });
});
