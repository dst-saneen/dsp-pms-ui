import { DeliveryEmailContentService } from '../../src/modules/delivery/delivery-email-content.service';
import { OFFER_SIGNATURE_EVENTS } from '../../src/modules/delivery/resolution/delivery-event.registry';
import { DeliveryRecipientKind } from '@prisma/client';

describe('DeliveryEmailContentService snapshot rendering (P0.7)', () => {
  const event = {
    id: 'evt-1',
    eventType: OFFER_SIGNATURE_EVENTS.RESUBMISSION,
    aggregateId: 'sub-1',
    aggregateType: 'recruitment',
  };

  const recipient = {
    kind: DeliveryRecipientKind.CANDIDATE,
    recipientId: 'cand-1',
    channels: [],
    displayName: 'Jane Doe',
    subject: 'Please resubmit your signed offer letter',
  };

  it('embeds the dedicated resubmission token once at snapshot time', async () => {
    const decrypt = jest.fn().mockReturnValue('existing-token');
    const mockPrisma = {
      offerSignatureSubmission: {
        findUnique: jest.fn().mockResolvedValue({ jobOfferId: 'offer-1' }),
      },
      jobOffer: {
        findUnique: jest.fn().mockResolvedValue({
          signatureResubmissionTokenCiphertext: 'resubmission-cipher',
          signatureResubmissionExpiresAt: new Date(Date.now() + 86_400_000),
        }),
      },
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('https://app.example.test'),
    };

    const svc = new DeliveryEmailContentService(
      mockPrisma as never,
      { decrypt } as never,
      config as never,
    );

    const snapshot = await svc.renderSnapshot({
      event: event as never,
      recipient: recipient,
    });

    expect(decrypt).toHaveBeenCalledWith('resubmission-cipher');
    expect(decrypt).toHaveBeenCalledTimes(1);
    expect(snapshot.templateKey).toBe(
      `delivery.${OFFER_SIGNATURE_EVENTS.RESUBMISSION}`,
    );
    expect(snapshot.templateVersion).toBe('1');
    expect(snapshot.bodyText).toContain(
      'https://app.example.test/offer-response?token=existing-token',
    );
    expect(snapshot.bodyHtml).toContain('existing-token');
  });

  it('omits the link when the stored token has expired', async () => {
    const decrypt = jest.fn();
    const mockPrisma = {
      offerSignatureSubmission: {
        findUnique: jest.fn().mockResolvedValue({ jobOfferId: 'offer-1' }),
      },
      jobOffer: {
        findUnique: jest.fn().mockResolvedValue({
          signatureResubmissionTokenCiphertext: 'resubmission-cipher',
          signatureResubmissionExpiresAt: new Date(Date.now() - 1_000),
        }),
      },
    };
    const svc = new DeliveryEmailContentService(
      mockPrisma as never,
      { decrypt } as never,
      {
        getOrThrow: jest.fn().mockReturnValue('https://app.example.test'),
      } as never,
    );

    const snapshot = await svc.renderSnapshot({
      event: event as never,
      recipient: recipient,
    });

    expect(decrypt).not.toHaveBeenCalled();
    expect(snapshot.bodyText).not.toContain('offer-response');
    expect(snapshot.bodyText).toContain('original offer response link');
  });
});
