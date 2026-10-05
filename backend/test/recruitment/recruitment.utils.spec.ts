import { JobApplicationStatus, JobOpeningStatus } from '@prisma/client';

import {
  allowedApplicationTransitions,
  allowedOpeningTransitions,
  calculateWeightedTotal,
  isAllowedApplicationTransition,
  isAllowedOpeningTransition,
  normalizeEmail,
  normalizeMobile,
} from '../../src/modules/recruitment/core/recruitment.utils';

describe('recruitment.utils', () => {
  it('normalizes email and mobile values', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
    expect(normalizeMobile(' +91 98765 43210 ')).toBe('+919876543210');
    expect(normalizeMobile('9876543210')).toBe('9876543210');
  });

  it('calculates weighted totals from criterion scores', () => {
    expect(
      calculateWeightedTotal([
        { score: 5, weightPercent: 50 },
        { score: 3, weightPercent: 50 },
      ]),
    ).toBe(80);
  });

  it('allows APPLIED → SCREENING only when shortlist is disabled', () => {
    expect(
      isAllowedApplicationTransition(
        JobApplicationStatus.APPLIED,
        JobApplicationStatus.SCREENING,
        false,
      ),
    ).toBe(true);
    expect(
      isAllowedApplicationTransition(
        JobApplicationStatus.APPLIED,
        JobApplicationStatus.SHORTLISTED,
        false,
      ),
    ).toBe(false);
  });

  it('blocks APPLIED → SCREENING when shortlist is enabled', () => {
    expect(
      isAllowedApplicationTransition(
        JobApplicationStatus.APPLIED,
        JobApplicationStatus.SHORTLISTED,
        true,
      ),
    ).toBe(true);
    expect(
      isAllowedApplicationTransition(
        JobApplicationStatus.APPLIED,
        JobApplicationStatus.SCREENING,
        true,
      ),
    ).toBe(false);
    expect(
      isAllowedApplicationTransition(
        JobApplicationStatus.APPLIED,
        JobApplicationStatus.REJECTED,
        true,
      ),
    ).toBe(true);
    expect(
      isAllowedApplicationTransition(
        JobApplicationStatus.APPLIED,
        JobApplicationStatus.HIRED,
        true,
      ),
    ).toBe(false);
    expect(allowedApplicationTransitions.HIRED).toEqual([]);
  });

  it('allows SHORTLISTED → SCREENING and SHORTLISTED → REJECTED', () => {
    expect(
      isAllowedApplicationTransition(
        JobApplicationStatus.SHORTLISTED,
        JobApplicationStatus.SCREENING,
      ),
    ).toBe(true);
    expect(
      isAllowedApplicationTransition(
        JobApplicationStatus.SHORTLISTED,
        JobApplicationStatus.REJECTED,
      ),
    ).toBe(true);
    expect(
      isAllowedApplicationTransition(
        JobApplicationStatus.SHORTLISTED,
        JobApplicationStatus.HIRED,
      ),
    ).toBe(false);
  });

  it('allows valid opening transitions only', () => {
    expect(
      isAllowedOpeningTransition(JobOpeningStatus.DRAFT, JobOpeningStatus.OPEN),
    ).toBe(true);
    expect(
      isAllowedOpeningTransition(
        JobOpeningStatus.CLOSED,
        JobOpeningStatus.OPEN,
      ),
    ).toBe(false);
    expect(allowedOpeningTransitions.FILLED).toEqual([JobOpeningStatus.CLOSED]);
  });
});
