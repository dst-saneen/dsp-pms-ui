import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OnboardingTemplateDashboard } from './onboarding-template-dashboard';

const useDesignationOnboardingWorkspace = vi.hoisted(() => vi.fn());

vi.mock('@/features/designation/hooks', () => ({
  useDesignationOnboardingWorkspace,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: {
      authorization: {
        activeCompanyId: 'company-india',
      },
    },
  }),
}));

vi.mock('@/components/common/workspace-shell', () => ({
  WorkspaceShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../components', () => ({
  OnboardingTemplateSummaryCards: () => null,
  OnboardingTemplateToolbar: () => null,
  OnboardingTemplateTable: () => null,
}));

describe('OnboardingTemplateDashboard', () => {
  it('loads designations for the selected Company context', () => {
    useDesignationOnboardingWorkspace.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<OnboardingTemplateDashboard />);

    expect(useDesignationOnboardingWorkspace).toHaveBeenCalledWith({
      keyword: '',
      companyId: 'company-india',
    });
  });
});
