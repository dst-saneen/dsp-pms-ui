"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Circle, LoaderCircle, Rocket } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { organizationOnboardingService } from "@/features/organization-onboarding/organization-onboarding-service";
import { moduleCapabilitiesKeys } from "@/hooks/use-module-capabilities";
import { consumePostAuthDestination } from "@/lib/auth-next-path";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";
import { cn } from "@/lib/utils";

import type { OrganizationOnboardingStatus } from "../types";
import { OwnerEmployeeSelectionDialog } from "./owner-employee-selection-dialog";
import {
  getOnboardingHubProgress,
  type HubChecklistState,
} from "../hub-progress";

interface OnboardingHubSummaryProps {
  status: OrganizationOnboardingStatus;
}

/** Right summary sidebar — checklist + open workspace CTA. */
export function OnboardingHubSummary({ status }: OnboardingHubSummaryProps) {
  const progress = getOnboardingHubProgress(status);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refreshSession } = useAuth();
  const [selectionOpen, setSelectionOpen] = useState(false);

  const completeMutation = useMutation({
    mutationFn: organizationOnboardingService.complete,
    onSuccess: async (result) => {
      setSelectionOpen(false);
      const linkState = result.ownerEmployeeLink?.state;
      if (linkState === "NEEDS_REPAIR") {
        toast.warning(
          `Workspace opened, but your employee profile still needs repair. Support code: ${result.ownerEmployeeLink?.supportCode ?? "OES"}`,
        );
      } else {
        toast.success("Your organization is ready.");
      }

      // ORG-04 — refresh auth user (employeeId) and module capabilities before shell.
      try {
        await refreshSession();
      } catch {
        // Continue; AuthenticatedApp restore on next navigation may recover.
      }
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["organization-onboarding"],
        }),
        queryClient.invalidateQueries({
          queryKey: moduleCapabilitiesKeys.all,
        }),
      ]);

      router.replace(consumePostAuthDestination());
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <div className="rounded-[12px] border border-[rgba(20,30,50,0.06)] bg-white p-3 shadow-[0_8px_24px_rgba(16,26,51,0.04)] sm:p-3.5">
      <h2 className="text-[15px] font-bold tracking-[-0.02em] text-[#101A33]">
        Workspace summary
      </h2>

      <ul className="mt-2.5 space-y-2">
        {progress.checklist.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 text-[13px]"
          >
            <span
              className={cn(
                "flex min-w-0 items-center gap-2",
                item.state === "needed" ? "text-[#C84E32]" : "text-[#101A33]",
              )}
            >
              <ChecklistIcon state={item.state} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.label}</span>
                {item.guide ? (
                  <span className="mt-0.5 block text-[11px] leading-snug text-[#9AA3B2]">
                    {item.guide}
                  </span>
                ) : null}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0",
                item.state === "done" && "text-[#22A06B]",
                item.state === "needed" && "font-medium text-[#C84E32]",
                item.state === "later" && "text-[#9AA3B2]",
              )}
            >
              {item.detail}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 border-t border-[#EEF1F5] pt-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-[12px]">
          <span className="text-[#7D8798]">Setup progress</span>
          <span
            className={cn(
              "font-medium",
              progress.canOpenWorkspace ? "text-[#22A06B]" : "text-[#9AA3B2]",
            )}
          >
            {progress.percent}%
            {progress.remainingRequired > 0
              ? ` · ${progress.remainingRequired} required left`
              : " · Ready"}
          </span>
        </div>
        <div
          className="mb-3 h-2 overflow-hidden rounded-full bg-[#EEF1F5]"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Workspace setup progress"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-300",
              progress.canOpenWorkspace ? "bg-[#22A06B]" : "bg-[#F15A43]",
            )}
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        <Button
          type="button"
          disabled={!progress.canOpenWorkspace || completeMutation.isPending}
          onClick={() => setSelectionOpen(true)}
          className={cn(
            "h-11 w-full rounded-[10px] text-[14px] font-semibold text-white",
            progress.canOpenWorkspace
              ? "bg-[#F15A43] hover:bg-[#E04E39]"
              : "bg-[#F15A43]/45 hover:bg-[#F15A43]/45",
          )}
        >
          {completeMutation.isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Rocket className="size-4" aria-hidden="true" />
          )}
          Open my workspace
        </Button>
        <p className="mt-2 text-center text-[12px] text-[#9AA3B2]">
          {progress.canOpenWorkspace
            ? "Required setup is complete."
            : "Complete the required items to continue."}
        </p>
      </div>

      <OwnerEmployeeSelectionDialog
        open={selectionOpen}
        onOpenChange={setSelectionOpen}
        title="Confirm your employee assignment"
        description="Choose the active Company, Branch, Department, and Designation for your founding owner employee record."
        submitLabel="Open workspace"
        isPending={completeMutation.isPending}
        onSubmit={async (selection) => {
          await completeMutation.mutateAsync(selection);
        }}
      />
    </div>
  );
}

function ChecklistIcon({ state }: { state: HubChecklistState }) {
  if (state === "done") {
    return (
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#22A06B] text-white">
        <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }

  if (state === "needed") {
    return (
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#F15A43] text-white">
        <AlertCircle className="size-2.5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <Circle
      className="mt-0.5 size-4 shrink-0 text-[#D5DAE2]"
      aria-hidden="true"
    />
  );
}
