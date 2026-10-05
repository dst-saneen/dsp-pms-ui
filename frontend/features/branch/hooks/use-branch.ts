"use client";

import { useQuery } from "@tanstack/react-query";

import { BranchService } from "../services/branch-service";

export function useBranch(id?: string) {
  return useQuery({
    queryKey: ["branches", "detail", id],
    queryFn: () => BranchService.getBranch(id!),
    enabled: Boolean(id),
  });
}
