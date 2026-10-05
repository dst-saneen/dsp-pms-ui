import { DomainConflictException } from '../../../common';
import { PAYROLL_ERROR_CODES } from './payroll-error-codes';

export function resolveTaxProfileCountry(
  legalCountryCode: string | null | undefined,
  requestedCountryCode: string,
): string {
  const configured = legalCountryCode?.trim().toUpperCase();
  if (!configured || !/^[A-Z]{2}$/.test(configured)) {
    throw new DomainConflictException(
      PAYROLL_ERROR_CODES.VALIDATION_ERROR,
      'Configure the Company legal country before creating tax profiles.',
    );
  }

  const requested = requestedCountryCode.trim().toUpperCase();
  if (requested !== configured) {
    throw new DomainConflictException(
      PAYROLL_ERROR_CODES.VALIDATION_ERROR,
      `Tax profile country must match the Company legal country (${configured}).`,
    );
  }

  return configured;
}
