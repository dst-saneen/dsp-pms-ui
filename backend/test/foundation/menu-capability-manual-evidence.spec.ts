import { CompanyModuleCode } from '@prisma/client';

import { ModuleCapabilitiesService } from '../../src/modules/module-capabilities/module-capabilities.service';
import type { AuthenticatedUser } from '../../src/modules/auth/auth.types';

const LEARN = 'e4c645f1-2359-439c-ac68-41785cf11e82';
const DATASCAPE = 'eadf7f5f-1669-4e90-9f32-0a1040e7cebf';
const LEARN_BRANCH = '5c79da96-64e5-4027-83fc-4c1de736b10c';

const mockScope: {
  activeCompanyId: string | null;
  activeBranchId: string | null;
} = {
  activeCompanyId: LEARN,
  activeBranchId: LEARN_BRANCH,
};

jest.mock('../../src/common', () => {
  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
  const actual = jest.requireActual('../../src/common');
  return {
    ...actual,
    getOrganizationScope: () => mockScope,
  };
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
});

function createCapabilitiesService(modules: CompanyModuleCode[]) {
  return new ModuleCapabilitiesService(
    {
      getEnabledModules: jest.fn().mockResolvedValue(new Set(modules)),
    } as never,
    {
      get: jest.fn().mockReturnValue(true),
    } as never,
  );
}

function userFor(companyId: string, permissions: string[]): AuthenticatedUser {
  return {
    id: 'u1',
    username: 'user',
    mustChangePassword: false,
    sessionId: 's1',
    authorization: {
      roles: [],
      permissions,
      scopeLevel: 'COMPANY',
      isGlobal: false,
      activeCompanyId: companyId,
      activeBranchId: LEARN_BRANCH,
      availableScopes: [],
    },
  };
}

describe('Menu capability manual evidence (Company entitlement)', () => {
  afterEach(() => {
    mockScope.activeCompanyId = LEARN;
    mockScope.activeBranchId = LEARN_BRANCH;
    jest.clearAllMocks();
  });

  it('shows onboarding for a Company with ONBOARDING and hides it for one without', async () => {
    const learn = createCapabilitiesService([CompanyModuleCode.ONBOARDING]);
    await expect(
      learn.getForUser(userFor(LEARN, ['hr.onboarding.read'])),
    ).resolves.toMatchObject({ onboardingNav: true });

    mockScope.activeCompanyId = DATASCAPE;
    const datascape = createCapabilitiesService([]);
    await expect(
      datascape.getForUser(userFor(DATASCAPE, ['hr.onboarding.read'])),
    ).resolves.toMatchObject({ onboardingNav: false });
  });

  it('applies a Company entitlement across its branches', async () => {
    mockScope.activeBranchId = 'another-branch';
    const service = createCapabilitiesService([CompanyModuleCode.ONBOARDING]);

    await expect(
      service.getForUser(userFor(LEARN, ['hr.onboarding.read'])),
    ).resolves.toMatchObject({ onboardingNav: true });
  });
});

describe('Menu capability navigation contracts (Cases 5–6)', () => {
  const recruitmentParentPerms = [
    'hr.recruitment.read',
    'hr.recruitment.delivery.read',
  ];
  const leaveParentPerms = [
    'hr.leave.read',
    'hr.team.approve',
    'hr.calendar.read',
    'hr.team.read',
    'hr.holidays.read',
    'hr.comp-off.read',
  ];

  function parentVisible(anyPermissions: string[], userPermissions: string[]) {
    return anyPermissions.some((permission) =>
      userPermissions.includes(permission),
    );
  }

  function childVisible(
    required: string | string[],
    userPermissions: string[],
    mode: 'all' | 'any' = 'all',
  ) {
    const list = Array.isArray(required) ? required : [required];
    return mode === 'any'
      ? list.some((permission) => userPermissions.includes(permission))
      : list.every((permission) => userPermissions.includes(permission));
  }

  it('keeps a delivery-only user independent from the Recruitment module route', () => {
    const userPermissions = ['hr.recruitment.delivery.read'];
    expect(parentVisible(recruitmentParentPerms, userPermissions)).toBe(true);
    expect(childVisible('hr.recruitment.delivery.read', userPermissions)).toBe(
      true,
    );
    expect(childVisible('hr.recruitment.read', userPermissions)).toBe(false);
  });

  it('keeps calendar-only and team-only users inside the Leave parent', () => {
    expect(parentVisible(leaveParentPerms, ['hr.calendar.read'])).toBe(true);
    expect(parentVisible(leaveParentPerms, ['hr.team.read'])).toBe(true);
    expect(
      childVisible(
        ['hr.calendar.read', 'hr.team.read'],
        ['hr.team.read'],
        'any',
      ),
    ).toBe(true);
  });
});

describe('Menu capability manual evidence (Finance entitlement)', () => {
  const financeUser = userFor(LEARN, [
    'finance.transactions.read',
    'finance.reports.read',
  ]);

  it('hides Finance navigation when the Company lacks FINANCE', async () => {
    const service = createCapabilitiesService([]);
    await expect(service.getForUser(financeUser)).resolves.toMatchObject({
      finance: false,
      financeNav: false,
    });
  });

  it('shows Finance navigation when the Company is entitled and user is authorized', async () => {
    const service = createCapabilitiesService([CompanyModuleCode.FINANCE]);
    await expect(service.getForUser(financeUser)).resolves.toMatchObject({
      finance: true,
      financeNav: true,
    });
  });

  it('does not grant Finance navigation from entitlement alone', async () => {
    const service = createCapabilitiesService([CompanyModuleCode.FINANCE]);
    await expect(
      service.getForUser(userFor(LEARN, ['hr.self.read'])),
    ).resolves.toMatchObject({ financeNav: false });
  });
});
