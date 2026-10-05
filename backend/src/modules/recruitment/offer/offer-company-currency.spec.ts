import { BadRequestException } from '@nestjs/common';
import { JobApplicationStatus } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';

import type { Environment } from '../../../config';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { PasswordService } from '../../auth/password.service';
import type { RecruitmentCryptoService } from '../core/recruitment-crypto.service';
import type { RecruitmentDomainScopeService } from '../core/recruitment-domain-scope.service';
import type { RecruitmentDocumentService } from '../document/recruitment-document.service';
import type { RecruitmentOutboxService } from '../services/recruitment-outbox.service';
import type { JobApplicationTransitionService } from '../transitions';
import { OfferService } from './offer.service';

describe('OfferService Company Financial Profile currency', () => {
  const findUnique = jest.fn();
  const findLatestOffer = jest.fn();
  const createOffer = jest.fn<
    Promise<unknown>,
    [
      {
        data: {
          companyId: string;
          compensationCurrency: string;
        };
      },
    ]
  >();
  const configService = {
    getOrThrow: jest.fn((key: string) =>
      key === 'NODE_ENV' ? 'test' : 'http://localhost:3200',
    ),
  } as unknown as ConfigService<Environment, true>;
  let service: OfferService;

  const resolveCurrency = (companyId: string, requestedCurrency?: string) =>
    (
      service as unknown as {
        resolveCompanyCurrency(
          company: string,
          requested?: string,
        ): Promise<string>;
      }
    ).resolveCompanyCurrency(companyId, requestedCurrency);

  beforeEach(() => {
    findUnique.mockReset();
    findLatestOffer.mockReset();
    createOffer.mockReset();

    service = new OfferService(
      {
        companyFinancialProfile: { findUnique },
        jobOffer: {
          findFirst: findLatestOffer,
          create: createOffer,
        },
      } as unknown as PrismaService,
      {} as PasswordService,
      {} as RecruitmentDocumentService,
      {} as JobApplicationTransitionService,
      {} as RecruitmentOutboxService,
      {} as RecruitmentDomainScopeService,
      {} as RecruitmentCryptoService,
      configService,
    );

    const internals = service as unknown as {
      assertApplicationInScope: jest.Mock;
      assertReportingManager: jest.Mock;
      presentOffer: jest.Mock;
    };
    internals.assertApplicationInScope = jest.fn().mockResolvedValue({
      status: JobApplicationStatus.SELECTED,
      jobOpening: {
        companyId: 'company-ae',
        branchId: 'branch-ae',
        departmentId: 'department-ae',
        designationId: 'designation-ae',
        hiringManagerEmployeeId: 'manager-ae',
        targetJoiningDate: null,
        employmentType: null,
      },
    });
    internals.assertReportingManager = jest.fn().mockResolvedValue(undefined);
    internals.presentOffer = jest.fn((offer: unknown) => offer);
  });

  it('uses the configured Company currency without an application default', async () => {
    findUnique.mockResolvedValue({ baseCurrencyCode: 'aed' });

    await expect(resolveCurrency('company-ae')).resolves.toBe('AED');
  });

  it('rejects offer creation when the Company currency is not configured', async () => {
    findUnique.mockResolvedValue(null);

    await expect(resolveCurrency('company-ae')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a requested currency that differs from Company configuration', async () => {
    findUnique.mockResolvedValue({ baseCurrencyCode: 'AED' });

    let caught: unknown;
    try {
      await resolveCurrency('company-ae', 'INR');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    expect((caught as BadRequestException).getResponse()).toMatchObject({
      code: 'OFFER_CURRENCY_MISMATCH',
    });
  });

  it('uses the Company Financial Profile currency when creating a normal offer draft', async () => {
    findUnique.mockResolvedValue({ baseCurrencyCode: 'aed' });
    findLatestOffer.mockResolvedValue(null);
    createOffer.mockResolvedValue({ id: 'offer-1' });

    await service.createDraft('application-1', {
      compensationAmount: 12_000,
    });

    expect(createOffer).toHaveBeenCalledTimes(1);
    const createArgs = createOffer.mock.calls[0]?.[0];
    expect(createArgs?.data.companyId).toBe('company-ae');
    expect(createArgs?.data.compensationCurrency).toBe('AED');
  });

  it('rejects a normal offer draft before writing when the Company currency is missing', async () => {
    findUnique.mockResolvedValue(null);
    findLatestOffer.mockResolvedValue(null);

    await expect(
      service.createDraft('application-1', { compensationAmount: 12_000 }),
    ).rejects.toMatchObject({
      response: {
        code: 'COMPANY_CURRENCY_NOT_CONFIGURED',
      },
    });

    expect(createOffer).not.toHaveBeenCalled();
  });
});
