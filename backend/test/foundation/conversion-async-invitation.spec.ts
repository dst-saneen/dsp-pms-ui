import { OutboxEventStatus } from '@prisma/client';

import { DeliveryEmailContentService } from '../../src/modules/delivery/delivery-email-content.service';
import { ConversionService } from '../../src/modules/recruitment/conversion/conversion.service';

describe('Gate P0.10 — async employee invitation', () => {
  describe('DeliveryEmailContentService invitation bodies', () => {
    it('renders invitation email with accept link when action URL is present', async () => {
      const crypto = {
        decrypt: jest.fn().mockReturnValue('raw-invite-token'),
      };
      const prisma = {
        userInvitation: {
          findUnique: jest.fn().mockResolvedValue({
            tokenCiphertext: 'sealed',
            expiresAt: new Date(Date.now() + 86_400_000),
            revokedAt: null,
            consumedAt: null,
          }),
        },
      };
      const config = {
        getOrThrow: jest.fn().mockReturnValue('https://app.example.com'),
      };

      const service = new DeliveryEmailContentService(
        prisma as never,
        crypto as never,
        config as never,
      );

      const snapshot = await service.renderSnapshot({
        event: {
          id: 'ob-1',
          eventType: 'recruitment.employee.invitation',
          aggregateId: 'inv-1',
        } as never,
        recipient: {
          kind: 'EMPLOYEE',
          recipientId: 'emp-1',
          channels: ['EMAIL'],
          displayName: 'Ada Lovelace',
          subject: 'You are invited to Group ERP',
        } as never,
      });

      expect(snapshot.subject).toBe('You are invited to Group ERP');
      expect(snapshot.bodyText).toContain(
        'accept-invitation?token=raw-invite-token',
      );
      expect(snapshot.bodyHtml).toContain(
        'Set your password and activate your account',
      );
      expect(crypto.decrypt).toHaveBeenCalledWith('sealed');
    });
  });

  describe('ConversionService invitation repair', () => {
    it('re-queues PROCESSED outbox when DeliveryMessage is missing', async () => {
      const outboxUpdate = jest.fn(
        (args: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          void args;
          return Promise.resolve({});
        },
      );
      const prisma = {
        userInvitation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'inv-1',
            sentAt: null,
            userId: 'user-1',
            user: {
              employee: {
                id: 'emp-1',
                companyId: 'co-1',
                branchId: 'br-1',
                company: { companyGroupId: 'cg-1' },
              },
            },
          }),
        },
        outboxEvent: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'ob-1',
            status: OutboxEventStatus.PROCESSED,
            processedAt: new Date(),
          }),
          update: outboxUpdate,
        },
        deliveryMessage: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        $transaction: jest.fn(),
      };

      const service = new ConversionService(
        prisma as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );

      const result = await (
        service as unknown as {
          repairInvitationDelivery: (id: string) => Promise<{
            status: string;
            outboxStatus: string | null;
          }>;
        }
      ).repairInvitationDelivery('inv-1');

      const [updateArg] = outboxUpdate.mock.calls;
      expect(updateArg[0].where).toEqual({ id: 'ob-1' });
      expect(updateArg[0].data).toMatchObject({
        status: OutboxEventStatus.PENDING,
        lastErrorCode: 'INVITATION_DELIVERY_REPAIR',
      });
      expect(result.status).toBe('OUTBOX_PENDING');
      expect(result.outboxStatus).toBe(OutboxEventStatus.PENDING);
    });
  });
});
