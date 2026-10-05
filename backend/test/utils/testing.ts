/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { ModuleMetadata, Type } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

export function createDeepMock<T>(): jest.Mocked<T> {
  const cache = new Map<PropertyKey, unknown>();
  const target = jest.fn();

  return new Proxy(target, {
    get(currentTarget, property) {
      if (property === 'then') {
        return undefined;
      }

      if (Reflect.has(currentTarget, property)) {
        const value = Reflect.get(currentTarget, property, currentTarget);

        return typeof value === 'function' && !jest.isMockFunction(value)
          ? value.bind(currentTarget)
          : value;
      }

      if (!cache.has(property)) {
        cache.set(property, createDeepMock());
      }

      return cache.get(property);
    },
  }) as unknown as jest.Mocked<T>;
}

export async function compileTestingModule(
  metadata: ModuleMetadata,
  providers: Array<Type<unknown>> = [],
): Promise<TestingModule> {
  return Test.createTestingModule({
    ...metadata,
    providers: [...(metadata.providers ?? []), ...providers],
  })
    .useMocker(() => createDeepMock())
    .compile();
}
