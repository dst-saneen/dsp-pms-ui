"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { recruitmentKeys } from "../../hooks/query-keys";
import { getRecruitmentMutationMessage } from "../../utils/recruitment-errors";

import { JobOpeningService } from "../services/job-opening-service";
import type { CreateJobOpeningDto } from "../types/create-job-opening";
import type { JobOpeningSearch } from "../types/job-opening-search";
import type { UpdateJobOpeningDto } from "../types/update-job-opening";

function getMutationErrorMessage(error: unknown, fallback: string) {
  return getRecruitmentMutationMessage(error, fallback);
}

export function useJobOpenings(filters?: JobOpeningSearch) {
  return useQuery({
    queryKey: recruitmentKeys.openings.list(filters),
    queryFn: () => JobOpeningService.getAll(filters),
  });
}

export function useJobOpening(id?: string) {
  return useQuery({
    queryKey: recruitmentKeys.openings.detail(id ?? ""),
    queryFn: () => JobOpeningService.getById(id!),
    enabled: Boolean(id),
  });
}

export function usePublicationChecklist(id?: string) {
  return useQuery({
    queryKey: [...recruitmentKeys.openings.detail(id ?? ""), "publication-checklist"],
    queryFn: () => JobOpeningService.getPublicationChecklist(id!),
    enabled: Boolean(id),
  });
}

export function useCreateJobOpening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateJobOpeningDto) => JobOpeningService.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.openings.all(),
      });
      toast.success("Job opening draft created.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to create job opening."));
    },
  });
}

export function useUpdateJobOpening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateJobOpeningDto }) =>
      JobOpeningService.update(id, data),
    onSuccess: (opening) => {
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.openings.all(),
      });
      queryClient.setQueryData(
        recruitmentKeys.openings.detail(opening.id),
        opening,
      );
      toast.success("Job opening saved.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to save job opening."));
    },
  });
}

export function usePublishJobOpening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      JobOpeningService.publish(id, version),
    onSuccess: (opening) => {
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.openings.all(),
      });
      queryClient.setQueryData(
        recruitmentKeys.openings.detail(opening.id),
        opening,
      );
      toast.success("Job opening published.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to publish job opening."));
    },
  });
}

export function useHoldJobOpening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      JobOpeningService.hold(id, version),
    onSuccess: (opening) => {
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.openings.all(),
      });
      queryClient.setQueryData(
        recruitmentKeys.openings.detail(opening.id),
        opening,
      );
      toast.success("Job opening placed on hold.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to hold job opening."));
    },
  });
}

export function useReopenJobOpening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      JobOpeningService.reopen(id, version),
    onSuccess: (opening) => {
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.openings.all(),
      });
      queryClient.setQueryData(
        recruitmentKeys.openings.detail(opening.id),
        opening,
      );
      toast.success("Job opening reopened.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to reopen job opening."));
    },
  });
}

export function useCloseJobOpening() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      JobOpeningService.close(id, version),
    onSuccess: (opening) => {
      void queryClient.invalidateQueries({
        queryKey: recruitmentKeys.openings.all(),
      });
      queryClient.setQueryData(
        recruitmentKeys.openings.detail(opening.id),
        opening,
      );
      toast.success("Job opening closed.");
    },
    onError: (error) => {
      toast.error(getMutationErrorMessage(error, "Unable to close job opening."));
    },
  });
}
