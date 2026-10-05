import { Injectable } from '@nestjs/common';
import { OutboxEvent } from '@prisma/client';

import { getDeliveryEventDefinition } from './delivery-event.registry';
import { DeliveryOnboardingRecipientHandler } from './delivery-onboarding-recipient.handler';
import { DeliveryOfficeFinanceRecipientHandler } from './delivery-office-finance-recipient.handler';
import { DeliveryProjectRecipientHandler } from './delivery-project-recipient.handler';
import { DeliveryPayrollRecipientHandler } from './delivery-payroll-recipient.handler';
import type { RecipientResolutionResult } from './delivery-recipient.types';
import { DeliveryRecruitmentRecipientHandler } from './delivery-recruitment-recipient.handler';
import { DeliveryWorkforceRecipientHandler } from './delivery-workforce-recipient.handler';

@Injectable()
export class DeliveryRecipientResolverService {
  constructor(
    private readonly recruitment: DeliveryRecruitmentRecipientHandler,
    private readonly onboarding: DeliveryOnboardingRecipientHandler,
    private readonly project: DeliveryProjectRecipientHandler,
    private readonly payroll: DeliveryPayrollRecipientHandler,
    private readonly finance: DeliveryOfficeFinanceRecipientHandler,
    private readonly workforce: DeliveryWorkforceRecipientHandler,
  ) {}

  async resolve(event: OutboxEvent): Promise<RecipientResolutionResult> {
    const definition = getDeliveryEventDefinition(event.eventType);
    if (!definition) {
      return {
        recipients: [],
        exceptions: [
          {
            reasonCode: 'UNSUPPORTED_EVENT',
            redactedDetail: 'No typed delivery handler for this event type',
          },
        ],
      };
    }

    switch (definition.handlerKind) {
      case 'RECRUITMENT_APPLICATION':
        return this.recruitment.resolveApplication(event, definition);
      case 'RECRUITMENT_INTERVIEW':
        return this.recruitment.resolveInterview(event, definition);
      case 'RECRUITMENT_OFFER':
        return this.recruitment.resolveOffer(event, definition);
      case 'RECRUITMENT_SIGNATURE':
        return this.recruitment.resolveSignature(event, definition);
      case 'RECRUITMENT_INVITATION':
        return this.recruitment.resolveInvitation(event, definition);
      case 'ONBOARDING_TASK':
      case 'ONBOARDING':
        return this.onboarding.resolve(event, definition);
      case 'PROJECT':
        return this.project.resolve(event, definition);
      case 'PAYROLL_PAYSLIP':
        return this.payroll.resolve(event, definition);
      case 'OFFICE_FINANCE':
        return this.finance.resolve(event, definition);
      case 'WORKFORCE_NOTIFICATION':
        return this.workforce.resolve(event, definition);
      default:
        return {
          recipients: [],
          exceptions: [
            {
              reasonCode: 'UNSUPPORTED_EVENT',
              redactedDetail: 'No typed delivery handler for this event type',
            },
          ],
        };
    }
  }
}
