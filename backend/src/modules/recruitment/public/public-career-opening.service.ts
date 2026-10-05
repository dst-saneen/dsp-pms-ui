import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyModuleCode, JobOpeningStatus } from '@prisma/client';

import { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompanyModuleEntitlementService } from '../../module-capabilities';
import { RecruitmentFeatureGateService } from '../services/recruitment-feature-gate.service';

export interface PublicCareerCompany {
  id: string;
  companyGroupId: string;
  companyCode: string;
  companyName: string;
}

export interface PublicCareerOpening {
  id: string;
  companyGroupId: string;
  companyId: string;
  branchId: string;
  openingCode: string;
  title: string;
  description: string | null;
  employmentType: string | null;
  location: string | null;
  applicationDeadline: Date | null;
  publishedAt: Date | null;
  department: { departmentName: string };
  designation: { designationName: string };
}

export interface ResolvePublicCareerOpeningOptions {
  requireFileStorage?: boolean;
}

/**
 * The single eligibility boundary for anonymous careers traffic.
 *
 * Controllers must resolve an opening here before exposing it, accepting an
 * application, or issuing/using an upload session. This prevents a public
 * upload route from drifting away from the careers catalogue's deployment,
 * entitlement, active-company, publication, or deadline checks.
 */
@Injectable()
export class PublicCareerOpeningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
    private readonly recruitmentFeature: RecruitmentFeatureGateService,
    private readonly entitlements: CompanyModuleEntitlementService,
  ) {}

  async listOpenings(companyCode: string): Promise<{
    company: PublicCareerCompany;
    openings: PublicCareerOpening[];
  }> {
    const company = await this.resolveCompany(companyCode);
    const openings = await this.prisma.jobOpening.findMany({
      where: this.publicOpeningWhere(company.id, company.companyGroupId),
      select: publicCareerOpeningSelect,
      orderBy: { publishedAt: 'desc' },
    });

    return { company, openings };
  }

  async resolveOpeningByCompanyCode(
    companyCode: string,
    openingCode: string,
    options: ResolvePublicCareerOpeningOptions = {},
  ): Promise<{ company: PublicCareerCompany; opening: PublicCareerOpening }> {
    const company = await this.resolveCompany(companyCode, options);
    const opening = await this.prisma.jobOpening.findFirst({
      where: {
        ...this.publicOpeningWhere(company.id, company.companyGroupId),
        openingCode,
      },
      select: publicCareerOpeningSelect,
    });

    if (!opening) {
      throw this.openingNotFound();
    }

    return { company, opening };
  }

  async resolveOpeningById(
    openingId: string,
    options: ResolvePublicCareerOpeningOptions = {},
  ): Promise<PublicCareerOpening> {
    this.assertPublicCareersEnabled();

    const openingRecord = await this.prisma.jobOpening.findFirst({
      where: {
        id: openingId,
        status: JobOpeningStatus.OPEN,
        publishedAt: { not: null },
        OR: [
          { applicationDeadline: null },
          { applicationDeadline: { gt: new Date() } },
        ],
        company: { isActive: true },
      },
      select: {
        ...publicCareerOpeningSelect,
        company: { select: { companyGroupId: true } },
      },
    });

    if (
      !openingRecord ||
      !openingRecord.company.companyGroupId ||
      openingRecord.company.companyGroupId !== openingRecord.companyGroupId
    ) {
      throw this.openingNotFound();
    }

    const opening: PublicCareerOpening = {
      id: openingRecord.id,
      companyGroupId: openingRecord.companyGroupId,
      companyId: openingRecord.companyId,
      branchId: openingRecord.branchId,
      openingCode: openingRecord.openingCode,
      title: openingRecord.title,
      description: openingRecord.description,
      employmentType: openingRecord.employmentType,
      location: openingRecord.location,
      applicationDeadline: openingRecord.applicationDeadline,
      publishedAt: openingRecord.publishedAt,
      department: openingRecord.department,
      designation: openingRecord.designation,
    };

    await this.assertCompanyAvailability(
      opening.companyId,
      opening.branchId,
      options,
    );
    return opening;
  }

  private async resolveCompany(
    companyCode: string,
    options: ResolvePublicCareerOpeningOptions = {},
  ): Promise<PublicCareerCompany> {
    this.assertPublicCareersEnabled();

    const company = await this.prisma.company.findFirst({
      where: {
        companyCode,
        isActive: true,
      },
      select: {
        id: true,
        companyGroupId: true,
        companyCode: true,
        companyName: true,
      },
    });

    if (!company) {
      throw new NotFoundException({
        code: 'COMPANY_NOT_FOUND',
        message: 'Company not found.',
      });
    }

    if (!company.companyGroupId) {
      throw new BadRequestException({
        code: 'COMPANY_GROUP_NOT_CONFIGURED',
        message: 'Public careers are unavailable for this company.',
      });
    }

    await this.assertCompanyAvailability(company.id, null, options);

    return {
      ...company,
      companyGroupId: company.companyGroupId,
    };
  }

  private publicOpeningWhere(companyId: string, companyGroupId: string) {
    return {
      companyId,
      companyGroupId,
      status: JobOpeningStatus.OPEN,
      publishedAt: { not: null },
      OR: [
        { applicationDeadline: null },
        { applicationDeadline: { gt: new Date() } },
      ],
    };
  }

  private assertPublicCareersEnabled(): void {
    if (this.config.get('PUBLIC_CAREERS_ENABLED', { infer: true })) {
      return;
    }

    throw new ForbiddenException({
      code: 'PUBLIC_CAREERS_DISABLED',
      message: 'Public careers is not enabled for this deployment.',
    });
  }

  private async assertCompanyAvailability(
    companyId: string,
    branchId: string | null,
    options: ResolvePublicCareerOpeningOptions,
  ): Promise<void> {
    await this.recruitmentFeature.assertEnabledForCompany(companyId);

    // A public opening is only usable when its required document workflow is
    // available. Callers must opt out explicitly for a future read-only use.
    if (options.requireFileStorage === false) {
      return;
    }

    void branchId;
    if (
      await this.entitlements.isEnabled(
        companyId,
        CompanyModuleCode.FILE_STORAGE,
      )
    ) {
      return;
    }

    throw new ForbiddenException({
      code: 'FILE_STORAGE_MODULE_NOT_ENABLED',
      message: 'File storage is not enabled for this Company.',
    });
  }

  private openingNotFound(): NotFoundException {
    return new NotFoundException({
      code: 'OPENING_NOT_FOUND',
      message: 'Opening not found.',
    });
  }
}

const publicCareerOpeningSelect = {
  id: true,
  companyGroupId: true,
  companyId: true,
  branchId: true,
  openingCode: true,
  title: true,
  description: true,
  employmentType: true,
  location: true,
  applicationDeadline: true,
  publishedAt: true,
  department: {
    select: { departmentName: true },
  },
  designation: {
    select: { designationName: true },
  },
} as const;
