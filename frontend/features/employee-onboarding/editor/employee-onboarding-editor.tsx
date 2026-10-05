"use client";

import { EmployeeOnboardingGeneral } from "./employee-onboarding-general";
import { useEmployeeOnboardingEditor } from "./use-employee-onboarding-editor";
import { EmployeeOnboardingProfileHeader } from "./employee-onboarding-profile-header";
import { EmployeeOnboardingTaskList } from "./employee-onboarding-task-list";
import { EmployeeOnboardingTimeline } from "./employee-onboarding-timeline";
import {
  EmployeeOnboardingTabs,
} from "./employee-onboarding-tabs";

import type {
  EmployeeOnboardingTabItem,
} from "./employee-onboarding-tabs";



export interface EmployeeOnboardingEditorProps {
  onboardingId: string;
}

export function EmployeeOnboardingEditor({
  onboardingId,
}: EmployeeOnboardingEditorProps) {
  const {
    onboarding,
    tasks,
    completeTask,
    startTask,
    skipTask,
    reopenTask,
    isLoading,
    completeOnboarding,
    cancelOnboarding,
    canComplete,
    canCancel,
  } = useEmployeeOnboardingEditor(onboardingId);

  if (isLoading) {
    return (
      <div className="p-6">
        Loading employee onboarding...
      </div>
    );
  }

  if (!onboarding) {
    return (
      <div className="p-6">
        Employee onboarding not found.
      </div>
    );
  }

  const tabs: EmployeeOnboardingTabItem[] = [
    {
        value: "general",
        label: "General",
        content: (
            <EmployeeOnboardingGeneral
            onboarding={onboarding}
            />
        ),
    },
    {
        value: "tasks",
        label: "Tasks",
        content: (
            <EmployeeOnboardingTaskList
                tasks={tasks}
                onStart={startTask}
                onComplete={completeTask}
                onSkip={skipTask}
                onReopen={reopenTask}
            />
        ),
    },
        {
        value: "timeline",
        label: "Timeline",
        content: (
            <EmployeeOnboardingTimeline
            onboarding={onboarding}
            />
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <EmployeeOnboardingProfileHeader
        onboarding={onboarding}
        canComplete={canComplete}
        canCancel={canCancel}
        onComplete={completeOnboarding}
        onCancel={cancelOnboarding}
      />
      <EmployeeOnboardingTabs tabs={tabs} />
    </div>
  );
}