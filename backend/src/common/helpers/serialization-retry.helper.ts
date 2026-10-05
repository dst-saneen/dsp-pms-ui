import { Prisma } from '@prisma/client';

export const SERIALIZATION_RETRY_LIMIT = 3;

const SERIALIZATION_SQLSTATES = new Set(['40001', '40P01']);

export function isSerializationFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: string;
    message?: string;
    meta?: { code?: string };
  };

  if (candidate.code === 'P2034') {
    return true;
  }

  if (candidate.code && SERIALIZATION_SQLSTATES.has(candidate.code)) {
    return true;
  }

  if (
    candidate.meta?.code &&
    SERIALIZATION_SQLSTATES.has(candidate.meta.code)
  ) {
    return true;
  }

  const message = candidate.message?.toLowerCase() ?? '';
  return (
    message.includes('could not serialize') ||
    message.includes('serialization failure') ||
    message.includes('deadlock detected')
  );
}

export async function withSerializationRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = SERIALIZATION_RETRY_LIMIT,
): Promise<T> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isSerializationFailure(error) || attempt >= maxAttempts) {
        throw error;
      }
    }
  }

  throw lastError;
}

export function isPrismaUniqueViolation(
  error: unknown,
  constraintFragment?: string,
): error is Prisma.PrismaClientKnownRequestError {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  if (!constraintFragment) {
    return true;
  }

  return prismaMetaTargetText(error.meta?.target).includes(constraintFragment);
}

export function prismaMetaTargetText(target: unknown): string {
  if (Array.isArray(target)) {
    return target
      .map((item) => (typeof item === 'string' ? item : ''))
      .join(',');
  }
  return typeof target === 'string' ? target : '';
}
