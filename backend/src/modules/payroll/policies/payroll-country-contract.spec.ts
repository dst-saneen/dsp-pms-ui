import { DomainConflictException } from '../../../common';
import { resolveTaxProfileCountry } from './payroll-country-contract';

describe('resolveTaxProfileCountry', () => {
  it('normalizes and returns the configured legal country', () => {
    expect(resolveTaxProfileCountry('ae', 'AE')).toBe('AE');
  });

  it('fails closed when the Company legal country is not configured', () => {
    expect(() => resolveTaxProfileCountry(null, 'IN')).toThrow(
      DomainConflictException,
    );
  });

  it('rejects a tax profile for a different country', () => {
    expect(() => resolveTaxProfileCountry('AE', 'IN')).toThrow(
      'Tax profile country must match the Company legal country (AE).',
    );
  });
});
