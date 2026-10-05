"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { recruitmentKeys } from "../../hooks/query-keys";
import { CareersService } from "../services/careers-service";
import type { SubmitPublicApplicationInput } from "../types/public-careers";
import { getPublicApplicationErrorMessage } from "../utils/public-application-errors";

function getSubmissionErrorMessage(error: unknown, fallback: string) {
  return getPublicApplicationErrorMessage(error, fallback);
}

export function usePublicCompany(companyCode: string) {
  return useQuery({
    queryKey: recruitmentKeys.careers.company(companyCode),
    queryFn: () => CareersService.getCompany(companyCode),
    retry: false,
  });
}

export function usePublicOpenings(companyCode: string) {
  return useQuery({
    queryKey: recruitmentKeys.careers.openings(companyCode),
    queryFn: () => CareersService.listOpenings(companyCode),
    retry: false,
  });
}

export function usePublicOpening(companyCode: string, openingCode: string) {
  return useQuery({
    queryKey: recruitmentKeys.careers.opening(companyCode, openingCode),
    queryFn: () => CareersService.getOpening(companyCode, openingCode),
    retry: false,
  });
}

export function useSubmitPublicApplication(companyCode: string, openingCode: string) {
  return useMutation({
    mutationFn: (input: SubmitPublicApplicationInput) =>
      CareersService.submitApplication(companyCode, openingCode, input),
    onError: () => undefined,
  });
}

export { getSubmissionErrorMessage };
