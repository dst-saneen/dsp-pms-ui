"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import {
  useEmployeeOnboarding,
  useCompleteEmployeeOnboarding,
  useCompleteEmployeeOnboardingTask,
  useDeleteEmployeeOnboarding,
  useReopenEmployeeOnboardingTask,
  useStartEmployeeOnboardingTask,
  useSkipEmployeeOnboardingTask,
} from "../hooks";

export function useEmployeeOnboardingEditor(
  onboardingId: string,
) {
  const router = useRouter();

  const {
    data: onboarding,
    isLoading,
    refetch,
  } = useEmployeeOnboarding(onboardingId);

  const completeOnboardingMutation =
    useCompleteEmployeeOnboarding();

  const deleteOnboardingMutation =
    useDeleteEmployeeOnboarding();

  const completeTaskMutation =
    useCompleteEmployeeOnboardingTask();

  const reopenTaskMutation =
    useReopenEmployeeOnboardingTask();

  const startTaskMutation =
    useStartEmployeeOnboardingTask();

  const skipTaskMutation =
    useSkipEmployeeOnboardingTask();

  const tasks = useMemo(
    () => onboarding?.tasks ?? [],
    [onboarding?.tasks],
  );

  const totalTasks = tasks.length;

  const completedTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.status === "COMPLETED" ||
          task.status === "SKIPPED",
      ).length,
    [tasks],
  );

  const mandatoryTasks = useMemo(
    () =>
      tasks.filter(
        (task) => task.isMandatory,
      ),
    [tasks],
  );

  const mandatoryCompleted = useMemo(
    () =>
      mandatoryTasks.every(
        (task) =>
          task.status === "COMPLETED" ||
          task.status === "SKIPPED",
      ),
    [mandatoryTasks],
  );

  const progress =
    totalTasks === 0
      ? 0
      : Math.round(
          (completedTasks /
            totalTasks) *
            100,
        );

  const canComplete =
    mandatoryCompleted &&
    totalTasks > 0;

  async function completeTask(
    taskId: string,
    remarks?: string,
  ) {
    await completeTaskMutation.mutateAsync({
      id: taskId,
      dto: {
        remarks,
      },
    });

    await refetch();
  }

  async function startTask(
    taskId: string,
    remarks?: string,
  ) {
    await startTaskMutation.mutateAsync({
      id: taskId,
      dto: {
        remarks,
      },
    });

    await refetch();
  }

  async function skipTask(
    taskId: string,
    reason: string,
  ) {
    await skipTaskMutation.mutateAsync({
      id: taskId,
      dto: {
        reason,
      },
    });

    await refetch();
  }

  async function reopenTask(
    taskId: string,
    reason: string,
  ) {
    await reopenTaskMutation.mutateAsync({
      id: taskId,
      dto: {
        reason,
      },
    });

    await refetch();
  }

  async function completeOnboarding() {
    if (!canComplete) {
      return;
    }

    await completeOnboardingMutation.mutateAsync({
      id: onboardingId,
      expectedOnboardingVersion: onboarding?.version,
    });

    await refetch();

    router.refresh();
  }

  async function cancelOnboarding() {
    await deleteOnboardingMutation.mutateAsync(
      onboardingId,
    );
  }

  async function refresh() {
    await refetch();
  }

  const canCancel =
    onboarding?.status !== "COMPLETED" &&
    onboarding?.status !== "CANCELLED";

  return {
    onboarding,
    tasks,
    isLoading,
    progress,
    totalTasks,
    completedTasks,
    mandatoryTasks,
    mandatoryCompleted,
    canComplete,
    canCancel,
    completeTask,
    startTask,
    skipTask,
    reopenTask,
    completeOnboarding,
    cancelOnboarding,
    refresh,
  };
}
