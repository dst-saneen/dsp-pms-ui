import type { QueryClient } from "@tanstack/react-query";

import { employeeOnboardingKeys } from "@/features/employee-onboarding/hooks/query-keys";
import { myWorkspaceKeys } from "@/features/my-workspace/hooks/use-my-workspace";

import { onboardingKeys, onboardingTaskKeys } from "./query-keys";

export async function invalidateOnboardingRuntime(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: onboardingKeys.all }),
    queryClient.invalidateQueries({ queryKey: onboardingTaskKeys.all }),
    queryClient.invalidateQueries({ queryKey: employeeOnboardingKeys.all }),
    queryClient.invalidateQueries({ queryKey: myWorkspaceKeys.root }),
    queryClient.invalidateQueries({ queryKey: ["manager-dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["employee"] }),
    queryClient.invalidateQueries({ queryKey: ["employee-career"] }),
    queryClient.invalidateQueries({ queryKey: ["employee-asset"] }),
    queryClient.invalidateQueries({ queryKey: ["asset"] }),
    queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  ]);
}
