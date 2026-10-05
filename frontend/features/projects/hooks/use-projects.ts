"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApiErrorMessage } from "@/services/api-client";
import { toast } from "sonner";

import { ProjectsApiService } from "../services/projects-api.service";
import { TimesheetsApiService } from "../services/timesheets-api.service";
import { projectsKeys } from "./query-keys";

export function useProjectsList(params?: {
  keyword?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: projectsKeys.list(params),
    queryFn: () => ProjectsApiService.list(params),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectsKeys.detail(id),
    queryFn: () => ProjectsApiService.get(id),
    enabled: Boolean(id),
  });
}

export function useProjectStages(id: string) {
  return useQuery({
    queryKey: projectsKeys.stages(id),
    queryFn: () => ProjectsApiService.listStages(id),
    enabled: Boolean(id),
  });
}

export function useProjectTeam(id: string) {
  return useQuery({
    queryKey: projectsKeys.team(id),
    queryFn: () => ProjectsApiService.listTeam(id),
    enabled: Boolean(id),
  });
}

export function useProjectTasks(id: string) {
  return useQuery({
    queryKey: projectsKeys.tasks(id),
    queryFn: () => ProjectsApiService.listTasks(id),
    enabled: Boolean(id),
  });
}

export function useProjectSummary(id: string) {
  return useQuery({
    queryKey: projectsKeys.summary(id),
    queryFn: () => ProjectsApiService.getSummary(id),
    enabled: Boolean(id),
  });
}

export function useProjectTimeSummary(id: string) {
  return useQuery({
    queryKey: projectsKeys.timeSummary(id),
    queryFn: () => ProjectsApiService.getTimeSummary(id),
    enabled: Boolean(id),
  });
}

export function useProjectFinanceSummary(id: string) {
  return useQuery({
    queryKey: projectsKeys.financeSummary(id),
    queryFn: () => ProjectsApiService.getFinanceSummary(id),
    enabled: Boolean(id),
  });
}

export function useMyProjectTasks(enabled = true) {
  return useQuery({
    queryKey: projectsKeys.myTasks(),
    queryFn: () => ProjectsApiService.listMyTasks(),
    enabled,
  });
}

export function useMyProjectTask(taskId: string | null, enabled = true) {
  return useQuery({
    queryKey: projectsKeys.myTask(taskId ?? ""),
    queryFn: () => ProjectsApiService.getMyTask(taskId!),
    enabled: enabled && Boolean(taskId),
  });
}

export function useMyTimesheets(params?: { status?: string }, enabled = true) {
  return useQuery({
    queryKey: projectsKeys.myTimesheets(params),
    queryFn: () => TimesheetsApiService.listMine(params),
    enabled,
  });
}

export function useMyTimesheet(id: string) {
  return useQuery({
    queryKey: projectsKeys.myTimesheet(id),
    queryFn: () => TimesheetsApiService.getMine(id),
    enabled: Boolean(id),
  });
}

export function useTeamTimesheets(params?: { status?: string }) {
  return useQuery({
    queryKey: projectsKeys.teamTimesheets(params),
    queryFn: () => TimesheetsApiService.listTeam(params),
  });
}

export function useInvalidateProject(id?: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: projectsKeys.all });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: projectsKeys.detail(id) });
    }
  };
}

export function useProjectCommand(projectId: string) {
  const invalidate = useInvalidateProject(projectId);
  return useMutation({
    mutationFn: (input: {
      action:
        | "activate"
        | "hold"
        | "resume"
        | "complete"
        | "cancel"
        | "archive";
      expectedVersion: number;
      reason?: string;
      operationId: string;
    }) =>
      ProjectsApiService.command(projectId, input.action, {
        expectedVersion: input.expectedVersion,
        operationId: input.operationId,
        reason: input.reason,
      }),
    onSuccess: () => {
      toast.success("Project updated");
      invalidate();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
      invalidate();
    },
  });
}

export function useTimesheetTeamCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      action: "approve" | "return";
      expectedVersion: number;
      reason?: string;
      operationId: string;
    }) =>
      input.action === "approve"
        ? TimesheetsApiService.approve(input.id, {
            expectedVersion: input.expectedVersion,
            operationId: input.operationId,
            reason: input.reason,
          })
        : TimesheetsApiService.returnTimesheet(input.id, {
            expectedVersion: input.expectedVersion,
            operationId: input.operationId,
            reason: input.reason,
          }),
    onSuccess: () => {
      toast.success("Timesheet updated");
      void queryClient.invalidateQueries({
        queryKey: projectsKeys.all,
      });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
      void queryClient.invalidateQueries({
        queryKey: projectsKeys.all,
      });
    },
  });
}
