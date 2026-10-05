import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';

import { ONBOARDING_ERROR_CODES } from '../constants/onboarding-error-codes';

const SERIALIZABLE_RETRY_LIMIT = 3;

@Injectable()
export class OnboardingTransactionRunnerService {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.withSerializableRetry(() =>
      this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>) {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < SERIALIZABLE_RETRY_LIMIT) {
      attempt += 1;

      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (
          !this.isSerializationFailure(error) ||
          attempt >= SERIALIZABLE_RETRY_LIMIT
        ) {
          if (
            this.isSerializationFailure(error) &&
            attempt >= SERIALIZABLE_RETRY_LIMIT
          ) {
            throw new DomainConflictException(
              ONBOARDING_ERROR_CODES.ONBOARDING_TRANSACTION_RETRY_EXHAUSTED,
              'Could not complete the onboarding command because of concurrent updates. Refetch and retry.',
            );
          }

          throw error;
        }
      }
    }

    throw lastError;
  }

  private isSerializationFailure(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as { code?: string; message?: string };

    if (candidate.code === 'P2034') {
      return true;
    }

    const message = candidate.message?.toLowerCase() ?? '';

    return (
      message.includes('could not serialize') ||
      message.includes('serialization') ||
      message.includes('deadlock')
    );
  }
}
