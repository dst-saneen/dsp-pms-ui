export type InteractiveTransaction = (
  transaction: Record<string, unknown>,
) => unknown;

export function withInteractiveTransaction(
  prisma: Record<string, unknown>,
): Record<string, unknown> {
  if (!('$transaction' in prisma)) {
    prisma.$transaction = jest.fn((callback: InteractiveTransaction) =>
      callback(prisma),
    );
  }

  return prisma;
}

export function createSessionServiceMock() {
  return {
    revokeAll: jest.fn().mockResolvedValue(undefined),
    revokeAllInTransaction: jest.fn().mockResolvedValue([]),
    invalidateSessionIds: jest.fn().mockResolvedValue(undefined),
  };
}
