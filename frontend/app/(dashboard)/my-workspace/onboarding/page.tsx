"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DepartmentOnboardingQueue } from "@/features/onboarding/components/DepartmentOnboardingQueue";
import { MyOnboardingJourney } from "@/features/onboarding/components/MyOnboardingJourney";
import { MyOnboardingTasks } from "@/features/onboarding/components/MyOnboardingTasks";
import { MyOwnOnboardingSummary } from "@/features/onboarding/components/MyOwnOnboardingSummary";
import {
  onboardingKeys,
  onboardingTaskKeys,
} from "@/features/onboarding/hooks/query-keys";
import { OnboardingApiService } from "@/features/onboarding/services/onboarding-api.service";
import { useAuth } from "@/providers/auth-provider";

function OnboardingRefreshButton() {
  const queryClient = useQueryClient();
  const onboardingFetching = useIsFetching({ queryKey: onboardingKeys.all });
  const tasksFetching = useIsFetching({ queryKey: onboardingTaskKeys.all });
  const refreshing = onboardingFetching + tasksFetching > 0;

  return (
    <Button
      type="button"
      variant="outline"
      disabled={refreshing}
      onClick={() => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: onboardingKeys.all }),
          queryClient.invalidateQueries({ queryKey: onboardingTaskKeys.all }),
        ]);
      }}
    >
      <RefreshCw
        data-icon="inline-start"
        className={refreshing ? "animate-spin" : undefined}
      />
      {refreshing ? "Refreshing" : "Refresh"}
    </Button>
  );
}

function MyWorkspaceOnboardingContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const taskId = searchParams.get("taskId");
  const requestedTab = searchParams.get("tab");

  const capabilitiesQuery = useQuery({
    queryKey: onboardingKeys.workspaceCapabilities(),
    queryFn: () => OnboardingApiService.getWorkspaceCapabilities(),
    enabled: Boolean(user),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const showMyTasks =
    capabilitiesQuery.data?.sections.includes("MY_TASKS") ?? false;
  const showDepartmentQueue =
    capabilitiesQuery.data?.sections.includes("DEPARTMENT_QUEUE") ?? false;

  const resolvedTab = useMemo(() => {
    if (requestedTab === "department-queue" && showDepartmentQueue) {
      return "department-queue";
    }
    return "my-onboarding";
  }, [requestedTab, showDepartmentQueue]);

  const capabilitiesLoading = capabilitiesQuery.isLoading;

  return (
    <ModuleCapabilityGate capability="onboardingNav">
      <OnboardingWorkspaceTabs
        key={resolvedTab}
        initialTab={resolvedTab}
        showDepartmentQueue={showDepartmentQueue}
        showMyTasks={showMyTasks}
        taskId={taskId}
        capabilitiesLoading={capabilitiesLoading}
        capabilitiesError={capabilitiesQuery.isError}
      />
    </ModuleCapabilityGate>
  );
}

function OnboardingWorkspaceTabs({
  initialTab,
  showDepartmentQueue,
  showMyTasks,
  taskId,
  capabilitiesLoading,
  capabilitiesError,
}: {
  initialTab: string;
  showDepartmentQueue: boolean;
  showMyTasks: boolean;
  taskId: string | null;
  capabilitiesLoading: boolean;
  capabilitiesError: boolean;
}) {
  const [activeTab, setActiveTab] = useState(initialTab);

  const focusTasks = () => {
    document
      .getElementById("my-onboarding-tasks")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
      <div className="border-b">
        <TabsList variant="line" className="h-10 gap-5 p-0">
          <TabsTrigger value="my-onboarding" className="px-1">
            My onboarding
          </TabsTrigger>
          {showDepartmentQueue ? (
            <TabsTrigger value="department-queue" className="px-1">
              Department queue
            </TabsTrigger>
          ) : null}
        </TabsList>
      </div>

      <TabsContent value="my-onboarding" className="mt-4 space-y-4">
        <MyOwnOnboardingSummary onOpenTasks={focusTasks} />

        {capabilitiesLoading ? <Skeleton className="h-80 rounded-xl" /> : null}

        {capabilitiesError ? (
          <p className="text-destructive text-sm">
            Could not load onboarding workspace permissions. Try Refresh.
          </p>
        ) : null}

        {!capabilitiesLoading ? (
          <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem]">
            {showMyTasks ? (
              <MyOnboardingTasks initialTaskId={taskId} />
            ) : (
              <div className="rounded-xl border p-6">
                <p className="font-medium">No onboarding tasks</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  No onboarding task queue is available for your account.
                </p>
              </div>
            )}
            <MyOnboardingJourney />
          </div>
        ) : null}
      </TabsContent>

      {showDepartmentQueue ? (
        <TabsContent value="department-queue" className="mt-4">
          <DepartmentOnboardingQueue initialTaskId={taskId} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

export default function MyWorkspaceOnboardingPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Onboarding"
        description="Track your onboarding progress and complete assigned tasks."
        actions={<OnboardingRefreshButton />}
      />
      <WorkspaceShell>
        <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
          <MyWorkspaceOnboardingContent />
        </Suspense>
      </WorkspaceShell>
    </PageContainer>
  );
}
