import { Injectable } from '@nestjs/common';
import {
  DeliveryChannel,
  DeliveryRecipientKind,
  OutboxEvent,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import type { DeliveryEventDefinition } from './delivery-event.registry';
import {
  candidateDisplayName,
  normalizeDeliveryEmail,
} from './delivery-email-normalize.util';
import { DeliveryHrRecipientService } from './delivery-hr-recipient.service';
import { buildDeliveryUserRecipients } from './delivery-user-recipient.util';
import type {
  DeliveryTenantSnapshot,
  RecipientResolutionResult,
  ResolvedRecipient,
  ResolutionExceptionInput,
} from './delivery-recipient.types';
import { tenantSnapshotFromOutbox } from './delivery-recipient.types';
import {
  tenantCheckToException,
  verifyTenantSnapshot,
} from './delivery-tenant-snapshot.util';

const JOB_OPENING_TENANT_SELECT = {
  id: true,
  companyGroupId: true,
  companyId: true,
  branchId: true,
} as const;

const CANDIDATE_SELECT = {
  id: true,
  email: true,
  normalizedEmail: true,
  firstName: true,
  lastName: true,
} as const;

type CandidateRow = {
  id: string;
  email: string;
  normalizedEmail: string;
  firstName: string;
  lastName: string | null;
};

type OpeningRow = {
  id: string;
  companyGroupId: string;
  companyId: string;
  branchId: string;
};

@Injectable()
export class DeliveryRecruitmentRecipientHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hrRecipients: DeliveryHrRecipientService,
  ) {}

  async resolveApplication(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    const application = await this.prisma.jobApplication.findUnique({
      where: { id: event.aggregateId },
      select: {
        id: true,
        candidate: { select: CANDIDATE_SELECT },
        jobOpening: { select: JOB_OPENING_TENANT_SELECT },
      },
    });

    if (!application) {
      return this.notFound(event, 'JobApplication');
    }

    return this.finishRecruitment({
      event,
      definition,
      opening: application.jobOpening,
      candidate: application.candidate,
    });
  }

  async resolveInterview(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    const session = await this.prisma.interviewSession.findUnique({
      where: { id: event.aggregateId },
      select: {
        id: true,
        jobApplication: {
          select: {
            candidate: { select: CANDIDATE_SELECT },
            jobOpening: { select: JOB_OPENING_TENANT_SELECT },
          },
        },
        panelMembers: {
          select: {
            id: true,
            assignmentStatus: true,
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
                    normalizedEmail: true,
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
      return this.notFound(event, 'InterviewSession');
    }

    const opening = session.jobApplication.jobOpening;
    const base = await this.finishRecruitment({
      event,
      definition,
      opening,
      candidate: session.jobApplication.candidate,
    });

    if (
      base.exceptions.some(
        (item) =>
          item.reasonCode === 'TENANT_MISMATCH' ||
          item.reasonCode === 'TENANT_SNAPSHOT_INCOMPLETE',
      )
    ) {
      return base;
    }

    if (definition.panelChannels && definition.panelChannels.length > 0) {
      const panel = this.resolvePanelMembers({
        members: session.panelMembers,
        opening,
        channels: definition.panelChannels,
        subject: definition.subject,
      });
      base.recipients.push(...panel.recipients);
      base.exceptions.push(...panel.exceptions);
    }

    return base;
  }

  async resolveOffer(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    const offer = await this.prisma.jobOffer.findUnique({
      where: { id: event.aggregateId },
      select: {
        id: true,
        jobApplication: {
          select: {
            candidate: { select: CANDIDATE_SELECT },
            jobOpening: { select: JOB_OPENING_TENANT_SELECT },
          },
        },
      },
    });

    if (!offer) {
      return this.notFound(event, 'JobOffer');
    }

    return this.finishRecruitment({
      event,
      definition,
      opening: offer.jobApplication.jobOpening,
      candidate: offer.jobApplication.candidate,
    });
  }

  async resolveSignature(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    const submission = await this.prisma.offerSignatureSubmission.findUnique({
      where: { id: event.aggregateId },
      select: {
        id: true,
        jobOffer: {
          select: {
            jobApplication: {
              select: {
                candidate: { select: CANDIDATE_SELECT },
                jobOpening: { select: JOB_OPENING_TENANT_SELECT },
              },
            },
          },
        },
      },
    });

    if (!submission) {
      return this.notFound(event, 'OfferSignatureSubmission');
    }

    return this.finishRecruitment({
      event,
      definition,
      opening: submission.jobOffer.jobApplication.jobOpening,
      candidate: submission.jobOffer.jobApplication.candidate,
    });
  }

  /**
   * Invitation recipient: reload UserInvitation → User/Employee through
   * Company/Branch scope. Never trust payload emails or company ids.
   */
  async resolveInvitation(
    event: OutboxEvent,
    definition: DeliveryEventDefinition,
  ): Promise<RecipientResolutionResult> {
    const invitation = await this.prisma.userInvitation.findUnique({
      where: { id: event.aggregateId },
      select: {
        id: true,
        email: true,
        normalizedEmail: true,
        expiresAt: true,
        revokedAt: true,
        consumedAt: true,
        user: {
          select: {
            id: true,
            displayName: true,
            status: true,
            employee: {
              select: {
                id: true,
                isActive: true,
                companyId: true,
                branchId: true,
                company: { select: { companyGroupId: true } },
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      return this.notFound(event, 'UserInvitation');
    }

    const employee = invitation.user.employee;
    if (!employee?.isActive) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'INVITATION_EMPLOYEE_UNAVAILABLE',
            redactedDetail: 'Linked employee is missing or inactive',
          },
        ],
      };
    }

    const aggregateSnapshot: DeliveryTenantSnapshot = {
      companyGroupId: employee.company.companyGroupId,
      companyId: employee.companyId,
      branchId: employee.branchId,
    };
    const tenantException = tenantCheckToException(
      verifyTenantSnapshot(tenantSnapshotFromOutbox(event), aggregateSnapshot),
    );
    if (tenantException) {
      return { recipients: [], exceptions: [tenantException] };
    }

    if (invitation.revokedAt || invitation.consumedAt) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'INVITATION_NOT_DELIVERABLE',
            redactedDetail: 'Invitation is revoked or already consumed',
          },
        ],
      };
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'INVITATION_EXPIRED',
            redactedDetail: 'Invitation token envelope has expired',
          },
        ],
      };
    }

    const email =
      normalizeDeliveryEmail(invitation.normalizedEmail) ??
      normalizeDeliveryEmail(invitation.email);
    if (!email || !definition.candidateChannels?.length) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'NO_SAFE_EMAIL',
            redactedDetail: 'Invitation has no safe email address',
          },
        ],
      };
    }

    return {
      recipients: [
        {
          kind: DeliveryRecipientKind.EMPLOYEE,
          recipientId: employee.id,
          recipientEmployeeId: employee.id,
          recipientUserId: invitation.user.id,
          channels: [...definition.candidateChannels],
          toAddress: email,
          displayName: invitation.user.displayName ?? undefined,
          subject: definition.subject,
        },
      ],
      exceptions: [],
    };
  }

  private async finishRecruitment(input: {
    event: OutboxEvent;
    definition: DeliveryEventDefinition;
    opening: OpeningRow;
    candidate: CandidateRow;
  }): Promise<RecipientResolutionResult> {
    const eventSnapshot = tenantSnapshotFromOutbox(input.event);
    const aggregateSnapshot: DeliveryTenantSnapshot = {
      companyGroupId: input.opening.companyGroupId,
      companyId: input.opening.companyId,
      branchId: input.opening.branchId,
    };
    const tenantException = tenantCheckToException(
      verifyTenantSnapshot(eventSnapshot, aggregateSnapshot),
    );
    if (tenantException) {
      return { recipients: [], exceptions: [tenantException] };
    }

    const recipients: ResolvedRecipient[] = [];
    const exceptions: ResolutionExceptionInput[] = [];

    if (input.definition.candidateChannels?.length) {
      const candidateRecipient = this.buildCandidateRecipient(
        input.candidate,
        input.definition.candidateChannels,
        input.definition.subject,
      );
      if (candidateRecipient) {
        recipients.push(candidateRecipient);
      } else {
        exceptions.push({
          reasonCode: 'NO_SAFE_EMAIL',
          redactedDetail: 'Candidate has no safe email address',
        });
      }
    }

    if (input.definition.hrPermission && input.definition.hrChannels?.length) {
      const hrUsers = await this.hrRecipients.resolveUsers({
        permissionCode: input.definition.hrPermission,
        tenant: aggregateSnapshot,
        allowGlobal: input.definition.allowGlobal === true,
      });
      if (hrUsers.length === 0) {
        exceptions.push({
          reasonCode: 'NO_HR_RECIPIENTS',
          redactedDetail: 'No HR users matched the exact RoleAssignment scope',
        });
      } else {
        const built = buildDeliveryUserRecipients({
          users: hrUsers,
          kind: DeliveryRecipientKind.HR,
          channels: input.definition.hrChannels,
          subject: input.definition.subject,
        });
        recipients.push(...built.recipients);
        exceptions.push(...built.exceptions);
      }
    }

    return { recipients, exceptions };
  }

  private buildCandidateRecipient(
    candidate: CandidateRow,
    channels: DeliveryChannel[],
    subject: string,
  ): ResolvedRecipient | null {
    const email =
      normalizeDeliveryEmail(candidate.normalizedEmail) ??
      normalizeDeliveryEmail(candidate.email);
    if (!email) {
      return null;
    }
    return {
      kind: DeliveryRecipientKind.CANDIDATE,
      recipientId: candidate.id,
      channels: [...channels],
      toAddress: email,
      displayName: candidateDisplayName(
        candidate.firstName,
        candidate.lastName,
      ),
      subject,
    };
  }

  private resolvePanelMembers(input: {
    members: Array<{
      id: string;
      assignmentStatus: string;
      employeeId: string;
      employee: {
        id: string;
        isActive: boolean;
        companyId: string;
        branchId: string;
        user: {
          id: string;
          email: string | null;
          normalizedEmail: string | null;
          displayName: string | null;
          status: UserStatus;
        } | null;
      };
    }>;
    opening: OpeningRow;
    channels: DeliveryChannel[];
    subject: string;
  }): RecipientResolutionResult {
    const recipients: ResolvedRecipient[] = [];
    const exceptions: ResolutionExceptionInput[] = [];
    let eligible = 0;

    for (const member of input.members) {
      if (member.assignmentStatus !== 'ASSIGNED') {
        continue;
      }
      const employee = member.employee;
      if (!employee.isActive) {
        continue;
      }
      if (employee.companyId !== input.opening.companyId) {
        continue;
      }
      if (employee.branchId !== input.opening.branchId) {
        continue;
      }
      const user = employee.user;
      if (!user || user.status !== UserStatus.ACTIVE) {
        continue;
      }
      eligible += 1;

      const email =
        normalizeDeliveryEmail(user.normalizedEmail) ??
        normalizeDeliveryEmail(user.email);
      const channels = input.channels.filter((channel) => {
        if (channel === DeliveryChannel.EMAIL) {
          return Boolean(email);
        }
        return true;
      });
      if (channels.length === 0) {
        exceptions.push({
          reasonCode: 'NO_SAFE_EMAIL',
          redactedDetail:
            'Panel member has no safe email for required channels',
        });
        continue;
      }
      if (input.channels.includes(DeliveryChannel.EMAIL) && !email) {
        exceptions.push({
          reasonCode: 'NO_SAFE_EMAIL',
          redactedDetail: 'Panel member has no safe email; in-app only',
        });
      }

      recipients.push({
        kind: DeliveryRecipientKind.PANEL_MEMBER,
        recipientId: member.id,
        recipientUserId: user.id,
        recipientEmployeeId: employee.id,
        channels,
        toAddress: email ?? undefined,
        displayName: user.displayName ?? undefined,
        subject: input.subject,
      });
    }

    if (eligible === 0) {
      exceptions.push({
        reasonCode: 'NO_PANEL_RECIPIENTS',
        redactedDetail:
          'No eligible assigned panel members in the Opening Company/Branch',
      });
    }

    return { recipients, exceptions };
  }

  private notFound(
    event: OutboxEvent,
    aggregateName: string,
  ): RecipientResolutionResult {
    return {
      recipients: [],
      exceptions: [
        {
          reasonCode: 'AGGREGATE_NOT_FOUND',
          redactedDetail: `${aggregateName} ${event.aggregateId} was not found`,
        },
      ],
    };
  }
}
