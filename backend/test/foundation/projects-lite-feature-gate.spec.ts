import { ForbiddenException } from '@nestjs/common';
import { CompanyModuleCode } from '@prisma/client';

import {
  DomainConflictException,
  requestContextStorage,
} from '../../src/common';
import { PROJECTS_ERROR_CODES } from '../../src/modules/projects/constants/projects-error-codes';
import { ProjectsFeatureGateService } from '../../src/modules/projects/services/projects-feature-gate.service';
import { ProjectsDomainScopeService } from '../../src/modules/projects/services/projects-domain-scope.service';

function createGate(
  enabledCompanyIds: string[] = [],
): ProjectsFeatureGateService {
  const enabled = new Set(enabledCompanyIds);
  return new ProjectsFeatureGateService({
    isEnabled: jest.fn(
      (companyId: string | null | undefined, module: CompanyModuleCode) =>
        Promise.resolve(
          module === CompanyModuleCode.PROJECTS &&
            companyId != null &&
            enabled.has(companyId),
        ),
    ),
    hasAnyEnabled: jest.fn().mockResolvedValue(enabled.size > 0),
  } as never);
}

describe('ProjectsFeatureGateService', () => {
  it('is fail-closed when the Company has no PROJECTS entitlement', async () => {
    const gate = createGate();

    await expect(gate.isEnabledForContext('company-1')).resolves.toBe(false);
    try {
      await gate.assertEnabledForContext('company-1');
      throw new Error('Expected the Projects gate to reject the Company.');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: PROJECTS_ERROR_CODES.PROJECTS_MODULE_NOT_ENABLED,
      });
    }
  });

  it('enables only Companies with a PROJECTS entitlement', async () => {
    const gate = createGate(['any-company']);

    await expect(gate.isEnabledForContext('any-company')).resolves.toBe(true);
    await expect(gate.isEnabledForContext('other-company')).resolves.toBe(
      false,
    );
  });

  it('rejects Global actors without an active Company', async () => {
    const gate = createGate(['company-1']);

    await requestContextStorage.run(
      {
        requestId: 'req-global',
        isGlobal: true,
        activeCompanyId: undefined,
      },
      async () => {
        await expect(gate.isEnabledForContext()).resolves.toBe(false);
        expect(() => gate.requireActiveCompanyId()).toThrow(
          DomainConflictException,
        );
        try {
          gate.requireActiveCompanyId();
        } catch (error) {
          expect((error as DomainConflictException).code).toBe(
            PROJECTS_ERROR_CODES.PROJECTS_COMPANY_CONTEXT_REQUIRED,
          );
        }
      },
    );
  });

  it('resolves the active Company entitlement', async () => {
    const gate = createGate(['aaa-111', 'bbb-222']);

    await requestContextStorage.run(
      {
        requestId: 'req-1',
        isGlobal: false,
        activeCompanyId: 'aaa-111',
      },
      async () => {
        await expect(gate.isEnabledForContext()).resolves.toBe(true);
      },
    );

    await expect(gate.isEnabledForContext('bbb-222')).resolves.toBe(true);
    await expect(gate.isEnabledForContext('ccc-333')).resolves.toBe(false);
  });

  it('never treats a missing Company as entitled for Global actors', async () => {
    const gate = createGate(['aaa-111']);

    await requestContextStorage.run(
      {
        requestId: 'req-2',
        isGlobal: true,
        activeCompanyId: undefined,
      },
      async () => {
        await expect(gate.isEnabledForContext()).resolves.toBe(false);
      },
    );
  });
});

describe('ProjectsDomainScopeService company context', () => {
  it('never returns an unrestricted projectWhere filter', () => {
    const gate = createGate(['co-1']);
    const scope = new ProjectsDomainScopeService(
      { project: { findFirst: jest.fn() } } as never,
      gate,
    );

    requestContextStorage.run(
      {
        requestId: 'req-3',
        isGlobal: true,
        activeCompanyId: undefined,
      },
      () => {
        expect(() => scope.projectWhere()).toThrow(DomainConflictException);
      },
    );

    requestContextStorage.run(
      {
        requestId: 'req-4',
        isGlobal: true,
        activeCompanyId: 'co-1',
      },
      () => {
        expect(scope.projectWhere()).toEqual({ companyId: 'co-1' });
      },
    );
  });

  it('ignores client-supplied company overrides', () => {
    const gate = createGate(['scoped-co']);
    const scope = new ProjectsDomainScopeService({} as never, gate);

    requestContextStorage.run(
      {
        requestId: 'req-5',
        isGlobal: false,
        activeCompanyId: 'scoped-co',
      },
      () => {
        expect(scope.requireCompanyId('attacker-co')).toBe('scoped-co');
      },
    );
  });
});
