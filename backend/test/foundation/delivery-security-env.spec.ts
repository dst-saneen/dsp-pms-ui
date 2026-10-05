import { parseDeliveryVersionedKeys } from '../../src/config/delivery-security-env';

describe('delivery-security-env', () => {
  describe('parseDeliveryVersionedKeys', () => {
    it('returns no keys when the setting is blank', () => {
      expect(parseDeliveryVersionedKeys(undefined, 'TEST_KEYS')).toEqual({});
      expect(parseDeliveryVersionedKeys('', 'TEST_KEYS')).toEqual({});
      expect(parseDeliveryVersionedKeys('   ', 'TEST_KEYS')).toEqual({});
    });

    it('parses 32-byte hex key material by version', () => {
      const keys = parseDeliveryVersionedKeys(
        JSON.stringify({ active: 'a'.repeat(64), previous: 'b'.repeat(64) }),
        'TEST_KEYS',
      );

      expect(keys.active).toEqual(Buffer.from('a'.repeat(64), 'hex'));
      expect(keys.previous).toEqual(Buffer.from('b'.repeat(64), 'hex'));
    });

    it('parses 32-byte base64 key material', () => {
      const material = Buffer.alloc(32, 7);
      const keys = parseDeliveryVersionedKeys(
        JSON.stringify({ active: material.toString('base64') }),
        'TEST_KEYS',
      );

      expect(keys.active).toEqual(material);
    });

    it('rejects malformed or non-object JSON', () => {
      expect(() => parseDeliveryVersionedKeys('{', 'TEST_KEYS')).toThrow(
        'TEST_KEYS must be valid JSON',
      );
      expect(() => parseDeliveryVersionedKeys('[]', 'TEST_KEYS')).toThrow(
        'TEST_KEYS must be a JSON object',
      );
      expect(() => parseDeliveryVersionedKeys('null', 'TEST_KEYS')).toThrow(
        'TEST_KEYS must be a JSON object',
      );
    });

    it('rejects empty and incorrectly sized key material', () => {
      expect(() =>
        parseDeliveryVersionedKeys(JSON.stringify({ active: '' }), 'TEST_KEYS'),
      ).toThrow('TEST_KEYS.active must be a key string');
      expect(() =>
        parseDeliveryVersionedKeys(
          JSON.stringify({ active: 'too-short' }),
          'TEST_KEYS',
        ),
      ).toThrow('TEST_KEYS.active must be 32 bytes (hex or base64)');
    });
  });
});
