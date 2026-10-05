"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { getApiErrorMessage } from "@/services/api-client";

import { OnboardingStatusBadge } from "../components/employee-onboarding-status-badge";
import { OnboardingProgress } from "../components/employee-onboarding-progress";

import type { EmployeeOnboarding } from "../types/employee-onboarding";

interface EmployeeOnboardingProfileHeaderProps {
  onboarding: EmployeeOnboarding;

  canComplete: boolean;

  canCancel: boolean;

  onComplete: () => Promise<void>;

  onCancel: () => Promise<void>;
}

export function EmployeeOnboardingProfileHeader({
  onboarding,
  canComplete,
  canCancel,
  onComplete,
  onCancel,
}: EmployeeOnboardingProfileHeaderProps) {
  const router = useRouter();
  const [completeConfirmOpen, setCompleteConfirmOpen] =
    useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] =
    useState(false);
  const [completeLoading, setCompleteLoading] =
    useState(false);
  const [cancelLoading, setCancelLoading] =
    useState(false);

  const completed =
    onboarding.tasks?.filter(
      (task) =>
        task.status === "COMPLETED" ||
        task.status === "SKIPPED",
    ).length ?? 0;

  const total =
    onboarding.tasks?.length ?? 0;

  const employeeName = `${onboarding.employee?.firstName ?? ""} ${onboarding.employee?.lastName ?? ""}`.trim() ||
    onboarding.employee?.employeeCode ||
    "Employee";

  const handleComplete = async () => {
    setCompleteLoading(true);

    try {
      await onComplete();
      setCompleteConfirmOpen(false);
      toast.success("Employee onboarding completed.");
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Could not complete onboarding.",
        ),
      );
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelLoading(true);

    try {
      await onCancel();
      setCancelConfirmOpen(false);
      toast.success("Employee onboarding cancelled.");
      router.push("/hr/employee-onboarding");
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Could not cancel onboarding.",
        ),
      );
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() =>
          router.push("/hr/employee-onboarding")
        }
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Employee Onboarding
      </Button>

      <Card>
        <CardContent className="p-8">
          <div className="flex items-start justify-between">
            <div className="space-y-5">
              <div>
                <h1 className="text-3xl font-bold">
                  {employeeName}
                </h1>

                <p className="text-muted-foreground">
                  {onboarding.employee?.employeeCode ?? "-"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  {onboarding.template?.templateName}
                </Badge>

                <OnboardingStatusBadge
                  status={onboarding.status}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  Employee
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  {onboarding.startDate}
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  {completed} / {total} Tasks
                </div>
              </div>

              <div className="max-w-md">
                <OnboardingProgress
                  completed={completed}
                  total={total}
                />
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {canCancel && (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setCancelConfirmOpen(true)
                    }
                  >
                    Cancel Onboarding
                  </Button>

                  {onboarding.status !== "COMPLETED" && (
                    <Button
                      onClick={() =>
                        setCompleteConfirmOpen(true)
                      }
                      disabled={!canComplete}
                    >
                      Complete Onboarding
                    </Button>
                  )}
                </div>
              )}

              {canCancel &&
                onboarding.status !== "COMPLETED" &&
                !canComplete && (
                  <p className="text-right text-xs text-muted-foreground">
                    Complete all mandatory tasks before finishing onboarding.
                  </p>
                )}
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmActionDialog
        open={completeConfirmOpen}
        onOpenChange={setCompleteConfirmOpen}
        title="Complete employee onboarding"
        message="All mandatory tasks must be finished before completing onboarding."
        name={employeeName}
        code={onboarding.employee?.employeeCode ?? "-"}
        loading={completeLoading}
        confirmLabel="Complete"
        loadingLabel="Completing..."
        onConfirm={() => {
          void handleComplete();
        }}
      />

      <ConfirmActionDialog
        open={cancelConfirmOpen}
        onOpenChange={setCancelConfirmOpen}
        title="Cancel employee onboarding"
        message="This cancels the in-progress onboarding workflow. Completed task history is retained for audit."
        name={employeeName}
        code={onboarding.employee?.employeeCode ?? "-"}
        loading={cancelLoading}
        confirmLabel="Cancel Onboarding"
        loadingLabel="Cancelling..."
        onConfirm={() => {
          void handleCancel();
        }}
      />
    </>
  );
}
