"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Flag, TriangleAlert } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/services/api-client";

import { onboardingKeys } from "../hooks/query-keys";
import { OnboardingApiService } from "../services/onboarding-api.service";
import { isCurrentRuntimeOnboarding } from "./MyOwnOnboardingSummary";

export function MyOnboardingJourney() {
  const query = useQuery({
    queryKey: onboardingKeys.me(),
    queryFn: () => OnboardingApiService.getMeOnboarding(),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-72 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (query.error) {
    return (
      <Card className="shadow-none">
        <CardContent className="py-6">
          <EmptyState
            icon={Building2}
            title="Could not load journey progress"
            description={getApiErrorMessage(
              query.error,
              "We could not load your department progress.",
            )}
            actionLabel="Retry"
            onAction={() => {
              void query.refetch();
            }}
          />
        </CardContent>
      </Card>
    );
  }

  const onboarding = query.data?.ownOnboarding;

  if (!onboarding || !isCurrentRuntimeOnboarding(onboarding)) {
    return null;
  }

  const hasDepartmentProgress = onboarding.departmentProgress.length > 0;
  const hasBlockedReasons = onboarding.blockedReasons.length > 0;

  if (!hasDepartmentProgress && !hasBlockedReasons) {
    return null;
  }

  return (
    <div className="space-y-4">
      {hasDepartmentProgress ? (
        <Card className="gap-0 py-0 shadow-none">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle role="heading" aria-level={2}>
              Journey progress
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Your progress across departments.
            </p>
          </CardHeader>
          <CardContent className="divide-y px-5">
            {onboarding.departmentProgress.map((department) => {
              const complete = department.percent >= 100;
              const nearComplete = department.percent >= 75;

              return (
                <div
                  key={department.workstreamDepartment.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 py-4"
                >
                  <div className="bg-muted mt-0.5 flex size-9 items-center justify-center rounded-lg">
                    <Building2 className="text-muted-foreground size-4" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-medium">
                        {department.workstreamDepartment.name}
                      </span>
                      <span
                        className={
                          complete
                            ? "shrink-0 text-xs font-medium text-emerald-600"
                            : "text-muted-foreground shrink-0 text-xs"
                        }
                      >
                        {complete
                          ? "Complete"
                          : `${department.mandatoryRemaining} remaining`}
                      </span>
                    </div>
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div
                        className={
                          complete || nearComplete
                            ? "h-full rounded-full bg-emerald-500"
                            : "h-full rounded-full bg-blue-500"
                        }
                        style={{ width: `${Math.min(Math.max(department.percent, 0), 100)}%` }}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {department.terminal} of {department.total} complete
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {hasBlockedReasons ? (
        <Card className="gap-0 py-0 shadow-none">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle
              role="heading"
              aria-level={2}
              className="flex items-center gap-2"
            >
              <Flag className="text-primary size-5" />
              Important notices
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-5 py-4">
            {onboarding.blockedReasons.map((reason) => (
              <div key={`${reason.code}-${reason.message}`} className="flex gap-3">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-muted-foreground text-sm leading-5">
                  {reason.message}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
