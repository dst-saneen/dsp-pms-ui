"use client";

import { getApiErrorMessage } from "@/services/api-client";
import { useAuth } from "@/providers/auth-provider";

import { useMyCareerTimeline } from "../hooks/use-employee-career";
import { CareerTimeline } from "./career-timeline";

export function MyCareerTimelinePanel() {
  const { user } = useAuth();
  const employeeId = user?.employeeId;
  const timelineQuery = useMyCareerTimeline(employeeId, Boolean(employeeId));

  if (!employeeId) {
    return (
      <p className="text-sm text-muted-foreground">
        Your user account is not linked to an employee record.
      </p>
    );
  }

  if (timelineQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your career timeline…</p>;
  }

  if (timelineQuery.error) {
    return (
      <p className="text-sm text-destructive">
        {getApiErrorMessage(timelineQuery.error, "We could not load your career timeline.")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Your career milestones. Confidential recruitment details are not shown here.
      </p>
      <CareerTimeline events={timelineQuery.data?.events ?? []} />
    </div>
  );
}
