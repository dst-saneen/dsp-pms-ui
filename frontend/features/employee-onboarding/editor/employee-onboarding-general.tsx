"use client";

import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  InfoCard,
} from "@/components/common/info-card";

import {
  InfoRow,
} from "@/components/common/info-row";

import { OnboardingStatusBadge } from "../components/employee-onboarding-status-badge";
import { OnboardingProgress } from "../components/employee-onboarding-progress";

import type { EmployeeOnboarding } from "../types/employee-onboarding";

interface EmployeeOnboardingGeneralProps {
  onboarding: EmployeeOnboarding;
}

export function EmployeeOnboardingGeneral({
  onboarding,
}: EmployeeOnboardingGeneralProps) {
  const completed =
    onboarding.tasks?.filter(
      (task) => task.status === "COMPLETED",
    ).length ?? 0;

  const total =
    onboarding.tasks?.length ?? 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <InfoCard title="Employee">
        <InfoRow
          label="Employee"
          value={`${onboarding.employee.firstName} ${onboarding.employee.lastName}`}
        />

        <InfoRow
          label="Employee Code"
          value={onboarding.employee.employeeCode}
        />

        <InfoRow
          label="Template"
          value={
            onboarding.template?.templateName ??
            "-"
          }
        />
      </InfoCard>

      <InfoCard title="Onboarding">
        <InfoRow
          label="Status"
          value={
            <OnboardingStatusBadge
              status={onboarding.status}
            />
          }
        />

        <InfoRow
          label="Progress"
          value={
            <div className="w-56">
              <OnboardingProgress
                completed={completed}
                total={total}
              />
            </div>
          }
        />

        <InfoRow
          label="Started"
          value={format(
            new Date(
              onboarding.startDate,
            ),
            "dd MMM yyyy",
          )}
        />

        <InfoRow
          label="Completed"
          value={
            onboarding.completedDate
              ? format(
                  new Date(
                    onboarding.completedDate,
                  ),
                  "dd MMM yyyy",
                )
              : "-"
          }
        />

        <InfoRow
          label="Remarks"
          value={
            onboarding.remarks || "-"
          }
        />
      </InfoCard>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>
            Progress Summary
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="text-sm">
            Total Tasks : {total}
          </div>

          <div className="text-sm">
            Completed Tasks : {completed}
          </div>

          <div className="text-sm">
            Pending Tasks :{" "}
            {total - completed}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}