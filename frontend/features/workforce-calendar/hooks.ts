"use client";

import { useQuery } from "@tanstack/react-query";

import { WorkforceCalendarService } from "./service";
import type { WorkforceCalendarFilters } from "./types";

export const workforceCalendarKeys = {
  all: ["workforce-calendar"] as const,
  options: ["workforce-calendar", "employee-options"] as const,
};

export function useWorkforceCalendar(filters: WorkforceCalendarFilters) {
  return useQuery({
    queryKey: [...workforceCalendarKeys.all, filters],
    queryFn: () => WorkforceCalendarService.getCalendar(filters),
  });
}

export function useTeamWorkforceCalendar(
  filters: Pick<WorkforceCalendarFilters, "fromDate" | "toDate" | "employeeId">,
) {
  return useQuery({
    queryKey: [...workforceCalendarKeys.all, "team", filters],
    queryFn: () => WorkforceCalendarService.getTeamCalendar(filters),
  });
}

export function useWorkforceCalendarEmployeeOptions(filters: {
  branchId?: string;
  departmentId?: string;
  q?: string;
}) {
  return useQuery({
    queryKey: [...workforceCalendarKeys.options, filters],
    queryFn: () => WorkforceCalendarService.getEmployeeOptions(filters),
  });
}
