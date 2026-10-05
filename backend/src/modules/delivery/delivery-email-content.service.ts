import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxEvent } from '@prisma/client';

import { Environment } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import { RecruitmentCryptoService } from '../recruitment/core/recruitment-crypto.service';
import { resolveNotificationHref } from '../notification/notification-href';
import {
  getDeliveryEventDefinition,
  OFFER_SIGNATURE_EVENTS,
} from './resolution/delivery-event.registry';
import type { ResolvedRecipient } from './resolution/delivery-recipient.types';

export interface DeliveryEmailSnapshot {
  templateKey: string;
  templateVersion: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

/**
 * Renders immutable email content once at fan-out.
 * Retries must reuse the sealed snapshot and must not call this again
 * to reload mutable Candidate/Offer/Interview values.
 */
@Injectable()
export class DeliveryEmailContentService {
  private readonly logger = new Logger(DeliveryEmailContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly crypto?: RecruitmentCryptoService,
    @Optional()
    private readonly configService?: ConfigService<Environment, true>,
  ) {}

  async renderSnapshot(input: {
    event: OutboxEvent;
    recipient: ResolvedRecipient;
  }): Promise<DeliveryEmailSnapshot> {
    const definition = getDeliveryEventDefinition(input.event.eventType);
    const templateKey = definition
      ? `delivery.${input.event.eventType}`
      : `delivery.${input.event.eventType}`;
    const templateVersion = '1';
    const subject =
      input.recipient.subject ??
      definition?.subject ??
      'A notification requires your attention';
    const name = input.recipient.displayName ?? 'there';
    const actionUrl = await this.resolveActionUrl(input.event);

    const bodies = this.renderBodies(
      input.event.eventType,
      name,
      subject,
      actionUrl,
    );

    return {
      templateKey,
      templateVersion,
      subject,
      bodyText: bodies.text,
      bodyHtml: bodies.html,
    };
  }

  /**
   * Loads a still-valid offer-response URL once for snapshotting.
   * Never generates a new token. Expired offers return null; callers
   * must use domain regeneration, not Delivery retry.
   */
  async resolveActionUrl(event: OutboxEvent): Promise<string | null> {
    if (!this.configService) {
      return null;
    }

    if (event.eventType === 'recruitment.employee.invitation') {
      return this.resolveInvitationUrl(event);
    }

    const needsOfferLink =
      event.eventType === 'recruitment.offer.sent' ||
      event.eventType === OFFER_SIGNATURE_EVENTS.RESUBMISSION;
    if (!needsOfferLink) {
      if (event.eventType.startsWith('recruitment.')) {
        return null;
      }
      const href = resolveNotificationHref(
        event.eventType,
        event.aggregateType,
        event.aggregateId,
      );
      if (!href) {
        return null;
      }
      const frontendUrl = this.configService.getOrThrow('FRONTEND_URL', {
        infer: true,
      });
      return `${frontendUrl.replace(/\/$/, '')}${href}`;
    }

    if (!this.crypto) {
      return null;
    }

    const jobOfferId = await this.resolveJobOfferId(event);
    if (!jobOfferId) {
      return null;
    }

    const offer = await this.prisma.jobOffer.findUnique({
      where: { id: jobOfferId },
      select: {
        responseTokenCiphertext: true,
        responseTokenExpiresAt: true,
        signatureResubmissionTokenCiphertext: true,
        signatureResubmissionExpiresAt: true,
      },
    });

    const isResubmission =
      event.eventType === OFFER_SIGNATURE_EVENTS.RESUBMISSION;
    const ciphertext = isResubmission
      ? offer?.signatureResubmissionTokenCiphertext
      : offer?.responseTokenCiphertext;
    const expiresAt = isResubmission
      ? offer?.signatureResubmissionExpiresAt
      : offer?.responseTokenExpiresAt;

    if (!ciphertext || (expiresAt && expiresAt < new Date())) {
      this.logger.warn({
        event: 'delivery.content.offer_link_unavailable',
        outboxEventId: event.id,
        eventType: event.eventType,
      });
      return null;
    }

    const token = this.crypto.decrypt(ciphertext);
    const frontendUrl = this.configService.getOrThrow('FRONTEND_URL', {
      infer: true,
    });
    return `${frontendUrl.replace(/\/$/, '')}/offer-response?token=${encodeURIComponent(token)}`;
  }

  private async resolveInvitationUrl(
    event: OutboxEvent,
  ): Promise<string | null> {
    const crypto = this.crypto;
    const configService = this.configService;
    if (!crypto || !configService) {
      return null;
    }

    const invitation = await this.prisma.userInvitation.findUnique({
      where: { id: event.aggregateId },
      select: {
        tokenCiphertext: true,
        expiresAt: true,
        revokedAt: true,
        consumedAt: true,
      },
    });

    if (
      !invitation?.tokenCiphertext ||
      invitation.revokedAt ||
      invitation.consumedAt ||
      invitation.expiresAt.getTime() <= Date.now()
    ) {
      this.logger.warn({
        event: 'delivery.content.invitation_link_unavailable',
        outboxEventId: event.id,
      });
      return null;
    }

    const token = crypto.decrypt(invitation.tokenCiphertext);
    const frontendUrl = configService.getOrThrow('FRONTEND_URL', {
      infer: true,
    });
    return `${frontendUrl.replace(/\/$/, '')}/accept-invitation?token=${encodeURIComponent(token)}`;
  }

  private async resolveJobOfferId(event: OutboxEvent): Promise<string | null> {
    if (event.eventType === 'recruitment.offer.sent') {
      return event.aggregateId;
    }

    if (event.eventType === OFFER_SIGNATURE_EVENTS.RESUBMISSION) {
      const submission = await this.prisma.offerSignatureSubmission.findUnique({
        where: { id: event.aggregateId },
        select: { jobOfferId: true },
      });
      return submission?.jobOfferId ?? null;
    }

    return null;
  }

  private renderBodies(
    eventType: string,
    name: string,
    subject: string,
    actionUrl: string | null,
  ): { text: string; html: string } {
    const safeName = this.escape(name);

    if (eventType === OFFER_SIGNATURE_EVENTS.VERIFIED) {
      return {
        text: `Hello ${name},\n\nYour signed offer has been verified.\n`,
        html: `<p>Hello ${safeName},</p><p>Your signed offer has been verified.</p>`,
      };
    }

    if (eventType === OFFER_SIGNATURE_EVENTS.REJECTED) {
      return {
        text: `Hello ${name},\n\nYour signed offer needs to be resubmitted. Use the original offer response link you received.\n`,
        html: `<p>Hello ${safeName},</p><p>Your signed offer needs to be resubmitted. Use the original offer response link you received.</p>`,
      };
    }

    if (eventType === OFFER_SIGNATURE_EVENTS.RESUBMISSION) {
      if (actionUrl) {
        return {
          text: `Hello ${name},\n\nPlease resubmit your signed offer letter. Use this existing offer response link: ${actionUrl}\n`,
          html: `<p>Hello ${safeName},</p><p>Please resubmit your signed offer letter.</p><p><a href="${this.escape(actionUrl)}">Open your offer response</a></p>`,
        };
      }
      return {
        text: `Hello ${name},\n\nPlease resubmit your signed offer letter using the original offer response link.\n`,
        html: `<p>Hello ${safeName},</p><p>Please resubmit your signed offer letter using the original offer response link.</p>`,
      };
    }

    if (eventType === 'recruitment.offer.sent') {
      if (actionUrl) {
        return {
          text: `Hello ${name},\n\nYou have received an employment offer. Review and respond here: ${actionUrl}\n`,
          html: `<p>Hello ${safeName},</p><p>You have received an employment offer.</p><p><a href="${this.escape(actionUrl)}">Review and respond to your offer</a></p>`,
        };
      }
      return {
        text: `Hello ${name},\n\nYou have received an employment offer. Use the offer response link provided by the recruiter.\n`,
        html: `<p>Hello ${safeName},</p><p>You have received an employment offer. Use the offer response link provided by the recruiter.</p>`,
      };
    }

    if (eventType === 'recruitment.employee.invitation') {
      if (actionUrl) {
        return {
          text: [
            `Hello ${name},`,
            '',
            'Your employee account is ready. Set your password and activate your account:',
            actionUrl,
            '',
            'If you were not expecting this invitation, you can ignore this email.',
          ].join('\n'),
          html: [
            `<p>Hello ${safeName},</p>`,
            '<p>Your employee account is ready.</p>',
            `<p><a href="${this.escape(actionUrl)}">Set your password and activate your account</a></p>`,
            '<p>If you were not expecting this invitation, you can ignore this email.</p>',
          ].join(''),
        };
      }
      return {
        text: `Hello ${name},\n\nYour employee account is ready. Request a new invitation if your activation link is unavailable.\n`,
        html: `<p>Hello ${safeName},</p><p>Your employee account is ready. Request a new invitation if your activation link is unavailable.</p>`,
      };
    }

    return actionUrl
      ? {
          text: `Hello ${name},\n\n${subject}\n\nView details: ${actionUrl}\n`,
          html: `<p>Hello ${safeName},</p><p>${this.escape(subject)}</p><p><a href="${this.escape(actionUrl)}">View details</a></p>`,
        }
      : {
          text: `Hello ${name},\n\n${subject}\n`,
          html: `<p>Hello ${safeName},</p><p>${this.escape(subject)}</p>`,
        };
  }

  private escape(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        })[character] ?? character,
    );
  }
}
