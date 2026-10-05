"use client";

import { useQuery } from "@tanstack/react-query";

import { ProjectsApiService } from "../services/projects-api.service";
import { projectsKeys } from "./query-keys";

export function useWorkspaceCapabilities() {
  return useQuery({
    queryKey: projectsKeys.capabilities(),
    queryFn: () => ProjectsApiService.getWorkspaceCapabilities(),
    staleTime: 60_000,
  });
}
