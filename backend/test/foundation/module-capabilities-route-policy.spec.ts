import { REQUIRED_PERMISSIONS_KEY } from '../../src/common/decorators/require-permissions.decorator';
import { MeController } from '../../src/modules/self-service/me.controller';

describe('Module capabilities route policy', () => {
  it('allows every authenticated role to resolve its Company navigation capabilities', () => {
    const handler: unknown = Object.getOwnPropertyDescriptor(
      MeController.prototype,
      'getModuleCapabilities',
    )?.value;

    expect(typeof handler).toBe('function');
    if (typeof handler !== 'function') {
      throw new TypeError('getModuleCapabilities handler is not available');
    }
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handler)).toEqual([]);
  });
});
