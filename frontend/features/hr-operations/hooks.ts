"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { HrOperationsApiService } from "./services/hr-operations-api.service";
import type {
  ClearanceCommandInput,
  CreateEmployeeSeparationInput,
  CreateHrRequestInput,
  CreateHrRequestTypeInput,
  HrRequestCommandInput,
  HrRequestFilters,
  SeparationCommandInput,
  SeparationFilters,
  UpdateHrRequestTypeInput,
} from "./types";

export const hrOperationsKeys = {
  all: ["hr-operations"] as const,
  types: () => [...hrOperationsKeys.all, "request-types"] as const,
  workflowCandidates: () => [...hrOperationsKeys.all, "workflow-candidates"] as const,
  requests: (filters?: HrRequestFilters) =>
    [...hrOperationsKeys.all, "requests", filters ?? {}] as const,
  allRequests: (filters?: Omit<HrRequestFilters, "page" | "limit">) =>
    [...hrOperationsKeys.all, "all-requests", filters ?? {}] as const,
  request: (id: string) => [...hrOperationsKeys.all, "request", id] as const,
  pendingRequestApprovals: () =>
    [...hrOperationsKeys.all, "request-approvals"] as const,
  separations: (filters?: SeparationFilters) =>
    [...hrOperationsKeys.all, "separations", filters ?? {}] as const,
  separation: (id: string) =>
    [...hrOperationsKeys.all, "separation", id] as const,
  pendingSeparationApprovals: () =>
    [...hrOperationsKeys.all, "separation-approvals"] as const,
  clearanceQueue: () => [...hrOperationsKeys.all, "clearance-queue"] as const,
};

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: hrOperationsKeys.all });
}

export function useHrRequestTypes(enabled = true) {
  return useQuery({
    queryKey: hrOperationsKeys.types(),
    queryFn: HrOperationsApiService.listRequestTypes,
    enabled,
  });
}

export function useHrRequestWorkflowCandidates() {
  return useQuery({
    queryKey: hrOperationsKeys.workflowCandidates(),
    queryFn: HrOperationsApiService.listWorkflowCandidates,
  });
}

export function useHrRequests(filters?: HrRequestFilters) {
  return useQuery({
    queryKey: hrOperationsKeys.requests(filters),
    queryFn: () => HrOperationsApiService.listRequests(filters),
  });
}

export function useAllHrRequests(
  filters?: Omit<HrRequestFilters, "page" | "limit">,
  enabled = true,
) {
  return useQuery({
    queryKey: hrOperationsKeys.allRequests(filters),
    queryFn: () => HrOperationsApiService.listAllRequests(filters),
    enabled,
  });
}

export function usePendingHrRequestApprovals() {
  return useQuery({
    queryKey: hrOperationsKeys.pendingRequestApprovals(),
    queryFn: HrOperationsApiService.listPendingRequestApprovals,
  });
}

export function useEmployeeSeparations(filters?: SeparationFilters) {
  return useQuery({
    queryKey: hrOperationsKeys.separations(filters),
    queryFn: () => HrOperationsApiService.listSeparations(filters),
  });
}

export function useEmployeeSeparation(id: string) {
  return useQuery({
    queryKey: hrOperationsKeys.separation(id),
    queryFn: () => HrOperationsApiService.getSeparation(id),
    enabled: Boolean(id),
  });
}

export function useClearanceDepartmentCandidates(employeeId: string) {
  return useQuery({
    queryKey: [...hrOperationsKeys.all, "clearance-department-candidates", employeeId] as const,
    queryFn: () => HrOperationsApiService.getClearanceDepartmentCandidates(employeeId),
    enabled: Boolean(employeeId),
  });
}

export function usePendingSeparationApprovals() {
  return useQuery({
    queryKey: hrOperationsKeys.pendingSeparationApprovals(),
    queryFn: HrOperationsApiService.listPendingSeparationApprovals,
  });
}

export function useClearanceQueue() {
  return useQuery({
    queryKey: hrOperationsKeys.clearanceQueue(),
    queryFn: HrOperationsApiService.listClearanceQueue,
  });
}

export function useCreateHrRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHrRequestInput) => HrOperationsApiService.createRequest(input),
    onSuccess: () => void invalidateAll(queryClient),
  });
}

export function useHrRequestCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, input }: { id: string; action: "approve" | "reject" | "complete" | "cancel"; input: HrRequestCommandInput }) =>
      HrOperationsApiService.requestCommand(id, action, input),
    onSuccess: () => void invalidateAll(queryClient),
  });
}

export function useCreateHrRequestType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHrRequestTypeInput) => HrOperationsApiService.createRequestType(input),
    onSuccess: () => void invalidateAll(queryClient),
  });
}

export function useUpdateHrRequestType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateHrRequestTypeInput }) =>
      HrOperationsApiService.updateRequestType(id, input),
    onSuccess: () => void invalidateAll(queryClient),
  });
}

export function useArchiveHrRequestType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => HrOperationsApiService.archiveRequestType(id),
    onSuccess: () => void invalidateAll(queryClient),
  });
}

export function useCreateEmployeeSeparation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeSeparationInput) => HrOperationsApiService.createSeparation(input),
    onSuccess: () => void invalidateAll(queryClient),
  });
}

export function useSeparationCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, input }: { id: string; action: "approve" | "reject" | "cancel" | "complete"; input: SeparationCommandInput }) =>
      HrOperationsApiService.separationCommand(id, action, input),
    onSuccess: () => void invalidateAll(queryClient),
  });
}

export function useClearanceCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, action, input }: { itemId: string; action: "clear" | "reopen"; input: ClearanceCommandInput }) =>
      HrOperationsApiService.clearanceCommand(itemId, action, input),
    onSuccess: () => void invalidateAll(queryClient),
  });
}
