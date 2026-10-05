import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, firstValueFrom } from 'rxjs';

import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';

describe('ResponseInterceptor single envelope', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  } as unknown as Reflector;

  const interceptor = new ResponseInterceptor(reflector);

  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;

  it('wraps domain data exactly once', async () => {
    const handler: CallHandler = {
      handle: () => of([{ id: 'lr-1' }]),
    };

    const result: unknown = await firstValueFrom(
      interceptor.intercept(context, handler),
    );

    expect(result).toEqual({
      success: true,
      data: [{ id: 'lr-1' }],
    });
    expect(result).not.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ success: true }) as unknown,
      }),
    );
  });

  it('does not nest a controller-owned success envelope when domain data is returned', async () => {
    const handler: CallHandler = {
      handle: () => of([]),
    };

    const result = await firstValueFrom(
      interceptor.intercept(context, handler),
    );

    expect(result).toEqual({
      success: true,
      data: [],
    });

    const nested =
      typeof result === 'object' &&
      result !== null &&
      'data' in result &&
      result.data &&
      typeof result.data === 'object' &&
      'success' in (result as { data: object }).data;

    expect(nested).toBe(false);
  });
});
