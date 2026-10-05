import { TemplateVersionStatus } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../src/common';
import { OnboardingTemplateVersionService } from '../../src/modules/onboarding-template/services/onboarding-template-version.service';

describe('OnboardingTemplateVersionService lifecycle', () => {
  const cloneService = {
    createDraft: jest.fn(),
  };
  const validationService = {
    validate: jest.fn(),
  };
  const templateScope = {
    requireTemplate: jest.fn(),
    requireVersion: jest.fn(),
    assertRowVersion: jest.fn(),
    resolveVersionCompanyId: jest.fn().mockReturnValue('co-1'),
    versionWhere: jest.fn().mockReturnValue({}),
  };
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };
  const outboxWriter = {
    write: jest.fn().mockResolvedValue(undefined),
  };
  const featureGate = {
    assertEnabledForContext: jest.fn(),
    isEnabledForContext: jest.fn().mockReturnValue(true),
  };

  function createService(prisma: Record<string, unknown>) {
    return new OnboardingTemplateVersionService(
      prisma as never,
      cloneService as never,
      validationService as never,
      templateScope as never,
      featureGate as never,
      auditService as never,
      outboxWriter as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns not found when validating an out-of-scope version', async () => {
    templateScope.requireVersion.mockRejectedValue(
      new DomainNotFoundException(
        'ONBOARDING_TEMPLATE_VERSION_NOT_FOUND',
        'Template version not found.',
      ),
    );

    const service = createService({});

    await expect(service.validate('ver-1')).rejects.toBeInstanceOf(
      DomainNotFoundException,
    );
    expect(validationService.validate).not.toHaveBeenCalled();
  });

  it('validates only after scope assert succeeds', async () => {
    templateScope.requireVersion.mockResolvedValue({
      id: 'ver-1',
      status: TemplateVersionStatus.DRAFT,
      onboardingTemplateId: 'tpl-1',
    });
    validationService.validate.mockResolvedValue({
      valid: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      warnings: [],
    });

    const service = createService({});
    const result = await service.validate('ver-1');

    expect(validationService.validate).toHaveBeenCalledWith('ver-1');
    expect(result.valid).toBe(true);
  });

  it('rejects publish when version is not draft', async () => {
    templateScope.requireVersion.mockResolvedValue({
      id: 'ver-1',
      status: TemplateVersionStatus.PUBLISHED,
      onboardingTemplateId: 'tpl-1',
      isCurrent: true,
      versionNo: 1,
      rowVersion: 1,
    });

    const service = createService({});

    await expect(service.publish('ver-1', 1)).rejects.toMatchObject({
      code: 'VERSION_NOT_DRAFT',
    });
  });

  it('rejects archive of current published version', async () => {
    templateScope.requireVersion.mockResolvedValue({
      id: 'ver-1',
      status: TemplateVersionStatus.PUBLISHED,
      isCurrent: true,
    });

    const service = createService({});

    await expect(service.archive('ver-1')).rejects.toBeInstanceOf(
      DomainConflictException,
    );
    await expect(service.archive('ver-1')).rejects.toMatchObject({
      code: 'CURRENT_VERSION_NOT_ARCHIVABLE',
    });
  });
});
