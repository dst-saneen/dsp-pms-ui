"use client";

import { useQuery } from "@tanstack/react-query";

import { BranchService } from "../services/branch-service";

export function useBranches(companyId?: string) {
  return useQuery({
    queryKey: ["branches", companyId],
    queryFn: () => BranchService.getBranches(companyId),
  });
}