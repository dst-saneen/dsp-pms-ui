import { BadRequestException } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';

import { CompanyService } from './company.service';

function createService(options?: {
  entitlementRows?: Array<{ module: CompanyModuleCode; isEnabled: boolean }>;
}) {
  const entitlementRows = options?.entitlementRows ?? [
    { module: CompanyModuleCode.FINANCE, isEnabled: true },
  ];
  const tx = {
    companyModuleEntitlement: {
      upsert: jest.fn(({ create }: { create: unknown }) =>
        Promise.resolve(create),
      ),
    },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    company: {
      findFirst: jest.fn().mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        companyGroupId: 'group-1',
        companyName: 'DSP India Services Pvt Ltd QA',
      }),
    },
    companyModuleEntitlement: {
      findMany: jest.fn().mockResolvedValue(entitlementRows),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  };
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const organizationScope = {
    companyGroupIdOrUndefined: jest.fn().mockReturnValue('group-1'),
    companyIdOrUndefined: jest.fn().mockReturnValue(undefined),
  };
  const service = new CompanyService(
    prisma as never,
    auditService as never,
    organizationScope as never,
    {} as never,
  );

  return { service, prisma, tx, auditService };
}

describe('CompanyService module entitlements', () => {
  it('returns every canonical module and marks missing rows disabled', async () => {
    const { service } = createService();

    const result = await (
      service as CompanyService & {
        findModuleEntitlements(companyId: string): Promise<{
          companyId: string;
          entitlements: Array<{
            module: CompanyModuleCode;
            isEnabled: boolean;
          }>;
        }>;
      }
    ).findModuleEntitlements('11111111-1111-4111-8111-111111111111');

    expect(result.companyId).toBe('11111111-1111-4111-8111-111111111111');
    expect(result.entitlements).toHaveLength(9);
    expect(result.entitlements).toEqual(
      expect.arrayContaining([
        { module: CompanyModuleCode.FINANCE, isEnabled: true },
        { module: CompanyModuleCode.PAYROLL, isEnabled: false },
      ]),
    );
  });

  it('rejects disabling a required module while its dependent remains enabled', async () => {
    const { service } = createService({
      entitlementRows: [
        { module: CompanyModuleCode.FINANCE, isEnabled: true },
        { module: CompanyModuleCode.FILE_STORAGE, isEnabled: true },
        { module: CompanyModuleCode.PAYROLL, isEnabled: true },
      ],
    });

    const update = () =>
      (
        service as CompanyService & {
          updateModuleEntitlements(
            companyId: string,
            dto: {
              entitlements: Array<{
                module: CompanyModuleCode;
                isEnabled: boolean;
              }>;
            },
          ): Promise<unknown>;
        }
      ).updateModuleEntitlements('11111111-1111-4111-8111-111111111111', {
        entitlements: [{ module: CompanyModuleCode.FINANCE, isEnabled: false }],
      });

    const error = await update().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as Error).message).toBe(
      'Payroll requires Finance and File storage to be enabled.',
    );
  });

  it('updates entitlements atomically and records one audited state change', async () => {
    const { service, prisma, tx, auditService } = createService({
      entitlementRows: [
        { module: CompanyModuleCode.FINANCE, isEnabled: true },
        { module: CompanyModuleCode.FILE_STORAGE, isEnabled: true },
        { module: CompanyModuleCode.PAYROLL, isEnabled: true },
      ],
    });

    const result = await (
      service as CompanyService & {
        updateModuleEntitlements(
          companyId: string,
          dto: {
            entitlements: Array<{
              module: CompanyModuleCode;
              isEnabled: boolean;
            }>;
          },
        ): Promise<{
          entitlements: Array<{
            module: CompanyModuleCode;
            isEnabled: boolean;
          }>;
        }>;
      }
    ).updateModuleEntitlements('11111111-1111-4111-8111-111111111111', {
      entitlements: [{ module: CompanyModuleCode.PAYROLL, isEnabled: false }],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.companyModuleEntitlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_module: {
            companyId: '11111111-1111-4111-8111-111111111111',
            module: CompanyModuleCode.PAYROLL,
          },
        },
        update: { isEnabled: false },
      }),
    );
    expect(auditService.log).toHaveBeenCalledTimes(1);
    expect(auditService.log).toHaveBeenCalledWith(
      'CompanyModuleEntitlement',
      '11111111-1111-4111-8111-111111111111',
      'UPDATE',
      expect.any(Array),
      expect.any(Array),
      { tx },
    );
    expect(
      result.entitlements.find(
        ({ module }) => module === CompanyModuleCode.PAYROLL,
      ),
    ).toEqual({ module: CompanyModuleCode.PAYROLL, isEnabled: false });
  });
});
