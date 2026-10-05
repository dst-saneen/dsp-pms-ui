import { PrismaService } from '../../src/prisma/prisma.service';
import { createDeepMock } from './testing';

export type PrismaServiceMock = jest.Mocked<PrismaService>;

export function createPrismaMock(): PrismaServiceMock {
  const prisma = createDeepMock<PrismaService>();

  Object.defineProperty(prisma, 'checkHealth', {
    configurable: true,
    enumerable: true,
    value: jest.fn(),
    writable: true,
  });

  return prisma;
}
