"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { InfoCard } from "@/components/common/info-card";
import { InfoRow } from "@/components/common/info-row";

import { useEmployeeOnboardingByEmployee } from "../hooks";
import { startEmployeeOnboardingHref } from "../lib/start-onboarding-navigation";

interface EmployeeOnboardingProfileProps {
  employeeId: string;
}

export function EmployeeOnboardingProfile({
  employeeId,
}: EmployeeOnboardingProfileProps) {
  const router = useRouter();

  const {
    data: onboarding,
    isLoading,
  } = useEmployeeOnboardingByEmployee(
    employeeId,
  );

  if (isLoading) {
    return (
      <div className="p-6">
        Loading onboarding...
      </div>
    );
  }

  if (!onboarding) {
    return (
      <InfoCard title="Employee Onboarding">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            No onboarding has been started.
          </p>

          <Button
            onClick={() =>
              router.push(
                startEmployeeOnboardingHref({
                  employeeId,
                  returnTo: `/hr/employees/${employeeId}`,
                }),
              )
            }
          >
            Start Onboarding
          </Button>
        </div>
      </InfoCard>
    );
  }

  const totalTasks =
    onboarding.tasks.length;

  const completedTasks =
    onboarding.tasks.filter(
      (task) =>
        task.status === "COMPLETED",
    ).length;

  const progress =
    totalTasks === 0
      ? 0
      : Math.round(
          (completedTasks /
            totalTasks) *
            100,
        );

  return (
    <InfoCard title="Employee Onboarding">

      <InfoRow
        label="Status"
        value={
          <Badge>
            {onboarding.status}
          </Badge>
        }
      />

      <InfoRow
        label="Template"
        value={
          onboarding.template
            ?.templateName ?? "-"
        }
      />

      <InfoRow
        label="Progress"
        value={`${progress}%`}
      />
      <div className="mt-3">
          <div className="flex justify-between text-sm mb-1">
            <span>Overall Progress</span>
            <span>{progress}%</span>
          </div>

          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </div>

      <div className="mt-5 space-y-2">

        <h4 className="font-medium">
            Current Tasks
        </h4>

        {onboarding.tasks
          .slice(0,5)
          .map(task=>(
            <div
              key={task.id}
              className="flex justify-between text-sm"
            >

              <span>
                  {task.taskName}
              </span>

              <Badge
                variant={
                  task.status==="COMPLETED"
                    ? "default"
                    : "secondary"
                }
              >
                  {task.status}
              </Badge>

            </div>
        ))}

      </div>

      <InfoRow
        label="Completed Tasks"
        value={`${completedTasks} / ${totalTasks}`}
      />

      <InfoRow
        label="Started"
        value={
          onboarding.startDate
            ? new Date(onboarding.startDate).toLocaleDateString()
            : "-"
        }
      />

      <InfoRow
        label="Completed"
        value={
          onboarding.completedDate
            ? new Date(onboarding.completedDate).toLocaleDateString()
            : "-"
        }
      />

      <InfoRow
        label="Mandatory Remaining"
        value={
          onboarding.tasks.filter(
            (task) =>
              task.isMandatory &&
              task.status !== "COMPLETED",
          ).length
        }
      />

      <InfoRow
        label="Pending Tasks"
        value={
          onboarding.tasks.filter(
            (task) => task.status === "PENDING",
          ).length
        }
      />

      <InfoRow
        label="In Progress"
        value={
          onboarding.tasks.filter(
            (task) =>
              task.status === "IN_PROGRESS",
          ).length
        }
      />

      <div className="pt-4">

        <Button
          onClick={() =>
            router.push(
              `/hr/employee-onboarding/${onboarding.id}`,
            )
          }
        >
          Open Onboarding
        </Button>

      </div>

    </InfoCard>
  );
}
