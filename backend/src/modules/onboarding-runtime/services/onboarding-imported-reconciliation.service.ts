import { Injectable } from '@nestjs/common';

import { DomainConflictException } from '../../../common';
import { ONBOARDING_ERROR_CODES } from '../constants/onboarding-error-codes';

@Injectable()
export class OnboardingImportedReconciliationService {
  assertNotImported(contractVersion: string | null | undefined): void {
    if (contractVersion === 'LEGACY_V1') {
      throw new DomainConflictException(
        ONBOARDING_ERROR_CODES.ONBOARDING_LEGACY_RECONCILIATION_REQUIRED,
        'Imported onboarding records require reconciliation before mutation.',
      );
    }
  }
}
