"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, ClipboardCheck } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiErrorMessage } from "@/services/api-client";

import { onboardingKeys } from "../hooks/query-keys";
import { OnboardingApiService } from "../services/onboarding-api.service";
import type { EmployeeOnboardingRuntimeView } from "../types/onboarding.types";

export function isCurrentRuntimeOnboarding(
  onboarding: NonNullable<
    Awaited<ReturnType<typeof OnboardingApiService.getMeOnboarding>>["ownOnboarding"]
  >,
): onboarding is EmployeeOnboardingRuntimeView {
  return onboarding.contractVersion === "V2";
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface MyOwnOnboardingSummaryProps {
  onOpenTasks?: () => void;
}

export function MyOwnOnboardingSummary({
  onOpenTasks,
}: MyOwnOnboardingSummaryProps) {
  const query = useQuery({
    queryKey: onboardingKeys.me(),
    queryFn: () => OnboardingApiService.getMeOnboarding(),
  });

  if (query.isLoading) {
    return <div className="bg-muted h-28 animate-pulse rounded-xl" />;
  }

  if (query.error) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Could not load onboarding summary"
        description={getApiErrorMessage(
          query.error,
          "We could not load your onboarding summary.",
        )}
        actionLabel="Retry"
        onAction={() => {
          void query.refetch();
        }}
      />
    );
  }

  const ownOnboarding = query.data?.ownOnboarding;

  if (!ownOnboarding) {
    return (
      <Card className="shadow-none">
        <CardContent className="py-8">
          <EmptyState
            icon={ClipboardCheck}
            title="No active onboarding"
            description="No active onboarding is associated with your employee account."
          />
        </CardContent>
      </Card>
    );
  }

  if (!isCurrentRuntimeOnboarding(ownOnboarding)) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-3 py-5">
          <StatusBadge label="Imported - read only" tone="warning" />
          <p className="text-muted-foreground text-sm">
            This onboarding record can be reviewed but cannot be changed from this
            workspace. Contact HR if it needs to be updated.
          </p>
        </CardContent>
      </Card>
    );
  }

  const action = onOpenTasks ? (
    <Button type="button" className="w-full sm:w-auto" onClick={onOpenTasks}>
      Continue next task
      <ArrowRight data-icon="inline-end" />
    </Button>
  ) : (
    <Button type="button" className="w-full sm:w-auto" asChild>
      <Link href="/my-workspace/onboarding?tab=my-onboarding">
        Continue next task
        <ArrowRight data-icon="inline-end" />
      </Link>
    </Button>
  );

  return (
    <Card className="gap-0 overflow-hidden rounded-lg py-0 shadow-none">
      <CardContent className="p-4 md:p-5">
        <div className="grid items-center gap-5 lg:grid-cols-[minmax(16rem,0.95fr)_minmax(24rem,1.45fr)_auto]">
          <div className="flex min-w-0 items-start gap-3">
            <StatusBadge
              label={formatStatus(ownOnboarding.status)}
              tone={ownOnboarding.status === "COMPLETED" ? "success" : "progress"}
              className={
                ownOnboarding.status === "COMPLETED"
                  ? "mt-0.5 shrink-0 rounded-full px-3"
                  : "mt-0.5 shrink-0 rounded-full border-blue-100 bg-blue-50 px-3 text-blue-700 [&>span]:bg-blue-500"
              }
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">
                {ownOnboarding.templateSnapshot.templateName}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Started {format(new Date(ownOnboarding.startDate), "dd MMM yyyy")}
              </p>
            </div>
          </div>

          <div className="border-border flex min-w-0 flex-col gap-3 lg:border-x lg:px-6">
            <div className="flex items-center gap-4">
              <span className="text-3xl font-semibold tracking-tight">
                {ownOnboarding.progress.percent}%
              </span>
              <div
                role="progressbar"
                aria-label="Onboarding progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={ownOnboarding.progress.percent}
                className="bg-muted h-2 w-full overflow-hidden rounded-full"
              >
                <div
                  className="h-full rounded-full bg-blue-500 transition-[width]"
                  style={{ width: `${ownOnboarding.progress.percent}%` }}
                />
              </div>
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-500" />
                {ownOnboarding.progress.completed} completed
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-slate-400" />
                {ownOnboarding.progress.mandatoryRemaining} mandatory remaining
              </span>
              {ownOnboarding.progress.overdue > 0 ? (
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full bg-rose-500" />
                  {ownOnboarding.progress.overdue} overdue
                </span>
              ) : null}
            </div>
          </div>

          <div className="lg:justify-self-end">{action}</div>
        </div>
      </CardContent>
    </Card>
  );
}
