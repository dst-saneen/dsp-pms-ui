import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobOfferStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { PasswordService } from '../../auth/password.service';
import { PrismaTx } from '../../outbox/outbox-writer.service';

export type PublicOfferInspectStatus =
  | 'VALID'
  | 'INVALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SUPERSEDED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'RESUBMISSION';

export interface PublicOfferTokenContext {
  inspectStatus: PublicOfferInspectStatus;
  code: string;
  message: string;
  jobOfferId: string;
  companyId: string;
  branchId: string;
  jobApplicationId: string;
  offerVersion: number;
  versionNo: number;
  tokenKind: 'RESPONSE' | 'RESUBMISSION';
  tokenHash: string;
}

export interface PublicOfferInspectResult {
  inspectStatus: PublicOfferInspectStatus;
  code: string;
  message: string;
  jobOfferId: string | null;
  companyId: string | null;
  branchId: string | null;
  jobApplicationId: string | null;
  offerVersion: number | null;
  versionNo: number | null;
  tokenKind: 'RESPONSE' | 'RESUBMISSION' | null;
  tokenHash: string | null;
}

type OfferTokenRow = {
  id: string;
  companyId: string;
  branchId: string;
  jobApplicationId: string;
  version: number;
  versionNo: number;
  status: JobOfferStatus;
  expiryDate: Date;
  responseTokenHash: string | null;
  responseTokenExpiresAt: Date | null;
  signatureResubmissionTokenHash: string | null;
  signatureResubmissionExpiresAt: Date | null;
  supersededByOfferId: string | null;
};

@Injectable()
export class PublicOfferTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Soft inspect for public UI — never throws for lifecycle states.
   * Unknown tokens return INVALID without revealing why.
   */
  async inspect(
    token: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<PublicOfferInspectResult> {
    const lookedUp = await this.lookupOffer(token, client);
    if (!lookedUp) {
      return {
        inspectStatus: 'INVALID',
        code: 'OFFER_TOKEN_INVALID',
        message: 'This offer link is invalid or expired.',
        jobOfferId: null,
        companyId: null,
        branchId: null,
        jobApplicationId: null,
        offerVersion: null,
        versionNo: null,
        tokenKind: null,
        tokenHash: null,
      };
    }

    return this.classify(
      lookedUp.offer,
      lookedUp.tokenKind,
      lookedUp.tokenHash,
    );
  }

  /**
   * Hard resolve for mutating public routes — throws stable public errors.
   */
  async resolve(
    token: string,
    client: PrismaTx | PrismaService = this.prisma,
  ): Promise<PublicOfferTokenContext> {
    const result = await this.inspect(token, client);

    if (
      result.inspectStatus === 'INVALID' ||
      !result.jobOfferId ||
      !result.tokenKind ||
      !result.tokenHash
    ) {
      throw new NotFoundException({
        code: 'OFFER_TOKEN_INVALID',
        message: 'This offer link is invalid or expired.',
      });
    }

    if (result.inspectStatus === 'REVOKED') {
      throw new BadRequestException({
        code: 'OFFER_REVOKED',
        message: 'This offer is no longer available.',
      });
    }

    if (result.inspectStatus === 'SUPERSEDED') {
      throw new BadRequestException({
        code: 'OFFER_SUPERSEDED',
        message: 'This offer has been replaced.',
      });
    }

    if (result.inspectStatus === 'DECLINED') {
      throw new BadRequestException({
        code: 'OFFER_ALREADY_RESPONDED',
        message: 'This offer has already been declined.',
      });
    }

    if (result.inspectStatus === 'EXPIRED') {
      throw new BadRequestException({
        code: 'OFFER_TOKEN_EXPIRED',
        message: 'This offer link has expired.',
      });
    }

    if (result.inspectStatus === 'ACCEPTED') {
      throw new BadRequestException({
        code: 'OFFER_ALREADY_RESPONDED',
        message: 'This offer has already been accepted.',
      });
    }

    if (
      result.inspectStatus !== 'VALID' &&
      result.inspectStatus !== 'RESUBMISSION'
    ) {
      throw new BadRequestException({
        code: 'OFFER_TOKEN_INVALID',
        message: 'This offer link is invalid or expired.',
      });
    }

    return {
      inspectStatus: result.inspectStatus,
      code: result.code,
      message: result.message,
      jobOfferId: result.jobOfferId,
      companyId: result.companyId!,
      branchId: result.branchId!,
      jobApplicationId: result.jobApplicationId!,
      offerVersion: result.offerVersion!,
      versionNo: result.versionNo!,
      tokenKind: result.tokenKind,
      tokenHash: result.tokenHash,
    };
  }

  async lockOffer(
    client: PrismaTx,
    jobOfferId: string,
    companyId: string,
  ): Promise<void> {
    await client.$queryRaw(
      Prisma.sql`SELECT id FROM job_offers WHERE id = ${jobOfferId} AND "companyId" = ${companyId} FOR UPDATE`,
    );
  }

  private async lookupOffer(
    token: string,
    client: PrismaTx | PrismaService,
  ): Promise<{
    offer: OfferTokenRow;
    tokenKind: 'RESPONSE' | 'RESUBMISSION';
    tokenHash: string;
  } | null> {
    const responseHash = this.passwordService.hashActionToken(
      'offer-response',
      token,
    );
    const resubmissionHash = this.passwordService.hashActionToken(
      'offer-signature-resubmission',
      token,
    );

    const offer = await client.jobOffer.findFirst({
      where: {
        OR: [
          { responseTokenHash: responseHash },
          { signatureResubmissionTokenHash: resubmissionHash },
        ],
      },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        jobApplicationId: true,
        version: true,
        versionNo: true,
        status: true,
        expiryDate: true,
        responseTokenHash: true,
        responseTokenExpiresAt: true,
        signatureResubmissionTokenHash: true,
        signatureResubmissionExpiresAt: true,
        supersededByOfferId: true,
      },
    });

    if (!offer) {
      return null;
    }

    const tokenKind: 'RESPONSE' | 'RESUBMISSION' =
      offer.signatureResubmissionTokenHash === resubmissionHash
        ? 'RESUBMISSION'
        : 'RESPONSE';

    return {
      offer,
      tokenKind,
      tokenHash: tokenKind === 'RESUBMISSION' ? resubmissionHash : responseHash,
    };
  }

  private classify(
    offer: OfferTokenRow,
    tokenKind: 'RESPONSE' | 'RESUBMISSION',
    tokenHash: string,
  ): PublicOfferInspectResult {
    const now = new Date();
    const base = {
      jobOfferId: offer.id,
      companyId: offer.companyId,
      branchId: offer.branchId,
      jobApplicationId: offer.jobApplicationId,
      offerVersion: offer.version,
      versionNo: offer.versionNo,
      tokenKind,
      tokenHash,
    };

    if (offer.status === JobOfferStatus.REVOKED) {
      return {
        ...base,
        inspectStatus: 'REVOKED',
        code: 'OFFER_REVOKED',
        message: 'This offer is no longer available.',
      };
    }

    if (
      offer.status === JobOfferStatus.SUPERSEDED ||
      offer.supersededByOfferId
    ) {
      return {
        ...base,
        inspectStatus: 'SUPERSEDED',
        code: 'OFFER_SUPERSEDED',
        message: 'This offer has been replaced.',
      };
    }

    if (offer.status === JobOfferStatus.DECLINED) {
      return {
        ...base,
        inspectStatus: 'DECLINED',
        code: 'OFFER_ALREADY_RESPONDED',
        message: 'This offer has already been declined.',
      };
    }

    if (tokenKind === 'RESUBMISSION') {
      if (
        !offer.signatureResubmissionExpiresAt ||
        offer.signatureResubmissionExpiresAt <= now
      ) {
        return {
          ...base,
          inspectStatus: 'EXPIRED',
          code: 'OFFER_TOKEN_EXPIRED',
          message: 'This offer link has expired.',
        };
      }
      if (offer.status !== JobOfferStatus.ACCEPTED) {
        return {
          ...base,
          inspectStatus: 'INVALID',
          code: 'OFFER_TOKEN_INVALID',
          message: 'This offer link is invalid or expired.',
        };
      }
      return {
        ...base,
        inspectStatus: 'RESUBMISSION',
        code: 'OFFER_RESUBMISSION',
        message: 'Signed offer resubmission is available.',
      };
    }

    if (offer.status === JobOfferStatus.ACCEPTED) {
      return {
        ...base,
        inspectStatus: 'ACCEPTED',
        code: 'OFFER_ALREADY_RESPONDED',
        message: 'This offer has already been accepted.',
      };
    }

    if (
      offer.status === JobOfferStatus.EXPIRED ||
      (offer.responseTokenExpiresAt && offer.responseTokenExpiresAt <= now) ||
      offer.expiryDate <= now
    ) {
      return {
        ...base,
        inspectStatus: 'EXPIRED',
        code: 'OFFER_TOKEN_EXPIRED',
        message: 'This offer link has expired.',
      };
    }

    if (offer.status !== JobOfferStatus.SENT) {
      return {
        ...base,
        inspectStatus: 'INVALID',
        code: 'OFFER_TOKEN_INVALID',
        message: 'This offer link is invalid or expired.',
      };
    }

    return {
      ...base,
      inspectStatus: 'VALID',
      code: 'OFFER_VALID',
      message: 'Offer is available.',
    };
  }
}
