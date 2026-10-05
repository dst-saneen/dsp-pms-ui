import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OutboxEvent,
  RecruitmentDeliveryStatus,
  UserStatus,
} from '@prisma/client';

import { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { TransactionalMailService } from '../../mail/transactional-mail.service';
import { UserNotificationService } from '../../notification/user-notification.service';
import { RecruitmentCryptoService } from '../core/recruitment-crypto.service';

@Injectable()
export class RecruitmentDeliveryProcessor {
  private readonly logger = new Logger(RecruitmentDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: TransactionalMailService,
    private readonly notifications: UserNotificationService,
    private readonly crypto: RecruitmentCryptoService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async process(event: OutboxEvent): Promise<void> {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const recipientUserIds = await this.resolveInternalRecipients(
      event,
      payload,
    );

    for (const userId of recipientUserIds) {
      await this.notifications.create({
        userId,
        companyGroupId: event.companyGroupId,
        companyId: event.companyId,
        branchId: event.branchId,
        eventCode: event.eventType,
        entityType: event.aggregateType,
        entityId: event.aggregateId,
        dedupeKey: `notification:${event.dedupeKey}:user:${userId}`,
      });
    }

    await this.deliverCandidateEmail(event, payload);
    await this.deliverPanelEmails(event, payload);
  }

  private async resolveInternalRecipients(
    event: OutboxEvent,
    payload: Record<string, unknown>,
  ): Promise<string[]> {
    const fromPayload = payload.recipientUserIds;
    if (Array.isArray(fromPayload) && fromPayload.length > 0) {
      return fromPayload.filter((id): id is string => typeof id === 'string');
    }

    const permissionCode =
      event.eventType === 'recruitment.conversion.completed' ||
      event.eventType === 'recruitment.ready_to_hire'
        ? 'hr.recruitment.convert'
        : event.eventType === 'recruitment.offer.sent' ||
            event.eventType === 'recruitment.offer.accepted' ||
            event.eventType.startsWith('recruitment.offer.signature.')
          ? 'hr.recruitment.offer'
          : 'hr.recruitment.manage';

    const users = await this.prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        roleAssignments: {
          some: {
            isActive: true,
            role: {
              permissions: {
                some: {
                  permission: { code: permissionCode },
                },
              },
            },
            OR: [
              { companyId: event.companyId ?? undefined },
              { branchId: event.branchId ?? undefined },
              { companyGroupId: event.companyGroupId ?? undefined },
              { scope: 'GLOBAL' },
            ],
          },
        },
      },
      select: { id: true },
      take: 200,
    });

    return [...new Set(users.map((user) => user.id))];
  }

  private async deliverCandidateEmail(
    event: OutboxEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (event.eventType === 'recruitment.employee.invitation') {
      await this.deliverEmployeeInvitation(event, payload);
      return;
    }

    const candidateId =
      typeof payload.candidateId === 'string' ? payload.candidateId : null;
    if (!candidateId) {
      return;
    }

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: candidateId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!candidate?.email) {
      return;
    }

    const displayName =
      `${candidate.firstName} ${candidate.lastName ?? ''}`.trim();
    const frontendUrl = this.configService.getOrThrow('FRONTEND_URL', {
      infer: true,
    });
    const deliveryAttemptId =
      typeof payload.deliveryAttemptId === 'string'
        ? payload.deliveryAttemptId
        : null;

    let result: 'SENT' | 'BYPASSED' = 'BYPASSED';

    try {
      if (event.eventType === 'recruitment.application.received') {
        result = await this.mail.sendRecruitmentMessage({
          to: candidate.email,
          displayName,
          subject: 'We received your application',
          text: `Hello ${displayName},\n\nWe received your application and will review it shortly.\n`,
          html: `<p>Hello ${this.escape(displayName)},</p><p>We received your application and will review it shortly.</p>`,
          clientReference: event.dedupeKey,
          failureEvent: 'email.recruitment.application_received.failed',
          companyId: event.companyId,
          branchId: event.branchId,
        });
      } else if (
        event.eventType === 'recruitment.interview.scheduled' ||
        event.eventType === 'recruitment.interview.rescheduled' ||
        event.eventType === 'recruitment.interview.cancelled'
      ) {
        const action =
          event.eventType === 'recruitment.interview.cancelled'
            ? 'cancelled'
            : event.eventType === 'recruitment.interview.rescheduled'
              ? 'updated'
              : 'scheduled';
        result = await this.mail.sendRecruitmentMessage({
          to: candidate.email,
          displayName,
          subject: `Your interview has been ${action}`,
          text: `Hello ${displayName},\n\nYour interview has been ${action}. Please check your interview details with the recruiter if needed.\n`,
          html: `<p>Hello ${this.escape(displayName)},</p><p>Your interview has been ${action}.</p>`,
          clientReference: event.dedupeKey,
          failureEvent: 'email.recruitment.interview.failed',
          companyId: event.companyId,
          branchId: event.branchId,
        });
      } else if (event.eventType === 'recruitment.offer.sent') {
        const jobOfferId =
          typeof payload.jobOfferId === 'string' ? payload.jobOfferId : null;
        if (!jobOfferId) {
          return;
        }
        const offer = await this.prisma.jobOffer.findUnique({
          where: { id: jobOfferId },
          select: { responseTokenCiphertext: true },
        });
        if (!offer?.responseTokenCiphertext) {
          throw new Error('OFFER_TOKEN_UNAVAILABLE');
        }
        const token = this.crypto.decrypt(offer.responseTokenCiphertext);
        const offerUrl = `${frontendUrl.replace(/\/$/, '')}/offer-response?token=${encodeURIComponent(token)}`;
        result = await this.mail.sendRecruitmentMessage({
          to: candidate.email,
          displayName,
          subject: 'Your employment offer',
          text: `Hello ${displayName},\n\nYou have received an employment offer. Review and respond here: ${offerUrl}\n`,
          html: `<p>Hello ${this.escape(displayName)},</p><p>You have received an employment offer.</p><p><a href="${this.escape(offerUrl)}">Review and respond to your offer</a></p>`,
          clientReference: event.dedupeKey,
          failureEvent: 'email.recruitment.offer_sent.failed',
          companyId: event.companyId,
          branchId: event.branchId,
        });
      } else if (event.eventType === 'recruitment.offer.signature.verified') {
        result = await this.mail.sendRecruitmentMessage({
          to: candidate.email,
          displayName,
          subject: 'Your offer has been verified',
          text: `Hello ${displayName},\n\nYour signed offer has been verified.\n`,
          html: `<p>Hello ${this.escape(displayName)},</p><p>Your signed offer has been verified.</p>`,
          clientReference: event.dedupeKey,
          failureEvent: 'email.recruitment.offer_signature.verified.failed',
          companyId: event.companyId,
          branchId: event.branchId,
        });
      } else if (event.eventType === 'recruitment.offer.signature.rejected') {
        result = await this.mail.sendRecruitmentMessage({
          to: candidate.email,
          displayName,
          subject: 'Your signed offer needs to be resubmitted',
          text: `Hello ${displayName},\n\nYour signed offer needs to be resubmitted. Use the original offer response link you received.\n`,
          html: `<p>Hello ${this.escape(displayName)},</p><p>Your signed offer needs to be resubmitted. Use the original offer response link you received.</p>`,
          clientReference: event.dedupeKey,
          failureEvent: 'email.recruitment.offer_signature.rejected.failed',
          companyId: event.companyId,
          branchId: event.branchId,
        });
      } else if (
        event.eventType === 'recruitment.offer.signature.resubmission.requested'
      ) {
        const jobOfferId =
          typeof payload.jobOfferId === 'string' ? payload.jobOfferId : null;
        if (!jobOfferId) {
          return;
        }
        const offer = await this.prisma.jobOffer.findUnique({
          where: { id: jobOfferId },
          select: {
            signatureResubmissionTokenCiphertext: true,
            signatureResubmissionExpiresAt: true,
          },
        });
        if (
          !offer?.signatureResubmissionTokenCiphertext ||
          (offer.signatureResubmissionExpiresAt &&
            offer.signatureResubmissionExpiresAt < new Date())
        ) {
          throw new Error('OFFER_TOKEN_UNAVAILABLE');
        }
        const token = this.crypto.decrypt(
          offer.signatureResubmissionTokenCiphertext,
        );
        const offerUrl = `${frontendUrl.replace(/\/$/, '')}/offer-response?token=${encodeURIComponent(token)}`;
        result = await this.mail.sendRecruitmentMessage({
          to: candidate.email,
          displayName,
          subject: 'Please resubmit your signed offer letter',
          text: `Hello ${displayName},\n\nPlease resubmit your signed offer letter. Use this existing offer response link: ${offerUrl}\n`,
          html: `<p>Hello ${this.escape(displayName)},</p><p>Please resubmit your signed offer letter.</p><p><a href="${this.escape(offerUrl)}">Open your offer response</a></p>`,
          clientReference: event.dedupeKey,
          failureEvent: 'email.recruitment.offer_signature.resubmission.failed',
          companyId: event.companyId,
          branchId: event.branchId,
        });
      } else if (
        event.eventType === 'recruitment.offer.accepted' ||
        event.eventType === 'recruitment.offer.declined'
      ) {
        const accepted = event.eventType === 'recruitment.offer.accepted';
        result = await this.mail.sendRecruitmentMessage({
          to: candidate.email,
          displayName,
          subject: accepted
            ? 'Offer acceptance confirmed'
            : 'Offer response recorded',
          text: `Hello ${displayName},\n\nYour offer response has been recorded.\n`,
          html: `<p>Hello ${this.escape(displayName)},</p><p>Your offer response has been recorded.</p>`,
          clientReference: event.dedupeKey,
          failureEvent: 'email.recruitment.offer_response.failed',
          companyId: event.companyId,
          branchId: event.branchId,
        });
      } else if (event.eventType === 'recruitment.conversion.completed') {
        return;
      } else {
        return;
      }

      if (deliveryAttemptId) {
        await this.prisma.recruitmentDeliveryAttempt.update({
          where: { id: deliveryAttemptId },
          data: {
            status:
              result === 'SENT'
                ? RecruitmentDeliveryStatus.SENT
                : RecruitmentDeliveryStatus.BYPASSED,
            processedAt: new Date(),
            lastErrorCode: null,
          },
        });
      }
    } catch (error) {
      if (deliveryAttemptId) {
        await this.prisma.recruitmentDeliveryAttempt.update({
          where: { id: deliveryAttemptId },
          data: {
            status: RecruitmentDeliveryStatus.FAILED,
            lastErrorCode: (error instanceof Error
              ? error.message
              : 'DELIVERY_FAILED'
            ).slice(0, 64),
          },
        });
      }
      this.logger.warn({
        event: 'recruitment.delivery.failed',
        eventType: event.eventType,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      throw error;
    }
  }

  private async deliverEmployeeInvitation(
    event: OutboxEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const frontendUrl = this.configService.getOrThrow('FRONTEND_URL', {
      infer: true,
    });
    const deliveryAttemptId =
      typeof payload.deliveryAttemptId === 'string'
        ? payload.deliveryAttemptId
        : null;

    try {
      const invitation = await this.prisma.userInvitation.findUnique({
        where: { id: event.aggregateId },
        select: {
          id: true,
          email: true,
          tokenCiphertext: true,
          expiresAt: true,
          revokedAt: true,
          consumedAt: true,
          user: { select: { displayName: true } },
        },
      });
      if (
        !invitation?.tokenCiphertext ||
        invitation.revokedAt ||
        invitation.consumedAt ||
        invitation.expiresAt.getTime() <= Date.now()
      ) {
        throw new Error('INVITATION_TOKEN_UNAVAILABLE');
      }
      const token = this.crypto.decrypt(invitation.tokenCiphertext);
      const invitationUrl = `${frontendUrl.replace(/\/$/, '')}/accept-invitation?token=${encodeURIComponent(token)}`;
      const inviteName = invitation.user.displayName ?? invitation.email;
      const result = await this.mail.sendInvitationLink({
        to: invitation.email,
        displayName: inviteName,
        invitationUrl,
        expiresInHours: Math.max(
          1,
          Math.ceil((invitation.expiresAt.getTime() - Date.now()) / 3_600_000),
        ),
        clientReference: event.dedupeKey,
      });
      if (result === 'SENT') {
        await this.prisma.userInvitation.updateMany({
          where: { id: invitation.id, sentAt: null },
          data: { sentAt: new Date() },
        });
      }
      if (deliveryAttemptId) {
        await this.prisma.recruitmentDeliveryAttempt.update({
          where: { id: deliveryAttemptId },
          data: {
            status:
              result === 'SENT'
                ? RecruitmentDeliveryStatus.SENT
                : RecruitmentDeliveryStatus.BYPASSED,
            processedAt: new Date(),
            lastErrorCode: null,
          },
        });
      }
    } catch (error) {
      if (deliveryAttemptId) {
        await this.prisma.recruitmentDeliveryAttempt.update({
          where: { id: deliveryAttemptId },
          data: {
            status: RecruitmentDeliveryStatus.FAILED,
            lastErrorCode: (error instanceof Error
              ? error.message
              : 'DELIVERY_FAILED'
            ).slice(0, 64),
          },
        });
      }
      this.logger.warn({
        event: 'recruitment.delivery.failed',
        eventType: event.eventType,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      throw error;
    }
  }

  private async deliverPanelEmails(
    event: OutboxEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const isInterviewEvent =
      event.eventType === 'recruitment.interview.scheduled' ||
      event.eventType === 'recruitment.interview.rescheduled' ||
      event.eventType === 'recruitment.interview.cancelled';

    if (!isInterviewEvent) {
      return;
    }

    const interviewSessionId =
      typeof payload.interviewSessionId === 'string'
        ? payload.interviewSessionId
        : null;

    if (!interviewSessionId) {
      return;
    }

    // Reload the session with panel members and their linked User + Employee.
    // We never trust payload email addresses — always reload from the DB.
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: interviewSessionId },
      select: {
        roundName: true,
        scheduledStartAt: true,
        jobApplication: {
          select: {
            candidate: {
              select: { firstName: true, lastName: true },
            },
            jobOpening: {
              select: {
                title: true,
                companyId: true,
                branchId: true,
              },
            },
          },
        },
        panelMembers: {
          select: {
            id: true,
            employeeId: true,
            employee: {
              select: {
                id: true,
                isActive: true,
                companyId: true,
                branchId: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                    displayName: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      this.logger.warn({
        event: 'recruitment.panel-email.session-not-found',
        interviewSessionId,
      });
      return;
    }

    const application = session.jobApplication;
    const candidateName =
      `${application.candidate.firstName} ${application.candidate.lastName ?? ''}`.trim();
    const openingTitle = application.jobOpening.title;
    const interviewDate = session.scheduledStartAt.toUTCString();
    const applicationCompanyId = application.jobOpening.companyId;
    const applicationBranchId = application.jobOpening.branchId;

    const action =
      event.eventType === 'recruitment.interview.cancelled'
        ? 'cancelled'
        : event.eventType === 'recruitment.interview.rescheduled'
          ? 'updated'
          : 'scheduled';

    for (const member of session.panelMembers) {
      const employee = member.employee;

      // Eligibility: active employee in same company and branch
      if (!employee.isActive) continue;
      if (employee.companyId !== applicationCompanyId) continue;
      if (
        applicationBranchId &&
        employee.branchId &&
        employee.branchId !== applicationBranchId
      )
        continue;

      const user = employee.user;

      // Must have an active User with an email address
      if (!user || user.status !== UserStatus.ACTIVE || !user.email) continue;

      const displayName = user.displayName ?? user.email;
      const clientReference = `panel-email:${interviewSessionId}:${member.id}:${event.dedupeKey}`;

      try {
        await this.mail.sendRecruitmentMessage({
          to: user.email,
          displayName,
          subject: `Interview ${action}: ${candidateName} — ${openingTitle}`,
          text: [
            `Hello ${displayName},`,
            ``,
            `An interview you are on the panel for has been ${action}.`,
            ``,
            `Candidate: ${candidateName}`,
            `Role: ${openingTitle}`,
            `Interview: ${session.roundName}`,
            `Date/time: ${interviewDate}`,
          ].join('\n'),
          html: [
            `<p>Hello ${this.escape(displayName)},</p>`,
            `<p>An interview you are on the panel for has been <strong>${action}</strong>.</p>`,
            `<ul>`,
            `<li><strong>Candidate:</strong> ${this.escape(candidateName)}</li>`,
            `<li><strong>Role:</strong> ${this.escape(openingTitle)}</li>`,
            `<li><strong>Interview:</strong> ${this.escape(session.roundName)}</li>`,
            `<li><strong>Date/time:</strong> ${this.escape(interviewDate)}</li>`,
            `</ul>`,
          ].join(''),
          clientReference,
          failureEvent: 'email.recruitment.panel.failed',
          companyId: event.companyId,
          branchId: event.branchId,
        });
      } catch (error) {
        // A single panel member failure must not block the others or the candidate email.
        this.logger.warn({
          event: 'recruitment.panel-email.failed',
          interviewSessionId,
          panelMemberId: member.id,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    }
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
