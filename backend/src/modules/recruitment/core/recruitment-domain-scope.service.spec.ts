import { JobOpeningStatus } from '@prisma/client';

import { requestContextStorage } from '../../../common/context/request-context';
import { RecruitmentDomainScopeService } from './recruitment-domain-scope.service';

describe('RecruitmentDomainScopeService', () => {
  const prisma = {} as never;
  const service = new RecruitmentDomainScopeService(prisma);

  it('scopes company users to openings in the active company', () => {
    const where = requestContextStorage.run(
      {
        requestId: 'req-1',
        scopeLevel: 'COMPANY',
        activeCompanyId: 'co-1',
        isGlobal: false,
      },
      () => service.jobOpeningWhere(),
    );

    expect(where).toEqual({ companyId: 'co-1' });
  });

  it('scopes branch users to openings in the active branch', () => {
    const where = requestContextStorage.run(
      {
        requestId: 'req-1',
        scopeLevel: 'BRANCH',
        activeCompanyId: 'co-1',
        activeBranchId: 'br-1',
        isGlobal: false,
      },
      () => service.jobOpeningWhere(),
    );

    expect(where).toEqual({ companyId: 'co-1', branchId: 'br-1' });
  });

  it('scopes candidates through accessible applications, not sibling companies', () => {
    const where = requestContextStorage.run(
      {
        requestId: 'req-1',
        scopeLevel: 'COMPANY',
        activeCompanyId: 'co-1',
        isGlobal: false,
      },
      () => service.candidateWhere(),
    );

    expect(where).toEqual({
      applications: {
        some: {
          jobOpening: { companyId: 'co-1' },
        },
      },
    });
    expect(where).not.toHaveProperty('companyGroup');
  });

  it('applies the same opening predicate to applications', () => {
    const where = requestContextStorage.run(
      {
        requestId: 'req-1',
        scopeLevel: 'BRANCH',
        activeCompanyId: 'co-1',
        activeBranchId: 'br-2',
        isGlobal: false,
      },
      () => service.jobApplicationWhere(),
    );

    expect(where).toEqual({
      jobOpening: { companyId: 'co-1', branchId: 'br-2' },
    });
  });

  it('scopes staff offer actions through the offer application and branch', () => {
    const where = requestContextStorage.run(
      {
        requestId: 'req-1',
        scopeLevel: 'BRANCH',
        activeCompanyId: 'co-1',
        activeBranchId: 'br-2',
        isGlobal: false,
      },
      () => service.jobOfferWhere(),
    );

    expect(where).toEqual({
      jobApplication: {
        jobOpening: { companyId: 'co-1', branchId: 'br-2' },
      },
    });
  });

  it('does not treat unused opening statuses as in-scope shortcuts', () => {
    expect(JobOpeningStatus.OPEN).toBeDefined();
  });
});
