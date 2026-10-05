"use client";

import { useRouter } from "next/navigation";

import { DataTable } from "@/components/tables/data-table";
import { getApiErrorMessage } from "@/services/api-client";

import { onboardingColumns } from "../components/employee-onboarding-columns";

import { useEmployeeOnboardings } from "../hooks/use-employee-onboardings";

import type { EmployeeOnboarding } from "../types/employee-onboarding";
import type { EmployeeOnboardingSearch } from "../types/employee-onboarding-search";

interface EmployeeOnboardingTableProps {
  searchParams?: EmployeeOnboardingSearch;
}

export function EmployeeOnboardingTable({ searchParams }: EmployeeOnboardingTableProps) {
  const router = useRouter();

  const {
    data: onboardings = [],
    isLoading,
    error,
    refetch,
  } = useEmployeeOnboardings(searchParams);

  return (
    <DataTable
      columns={onboardingColumns()}
      data={onboardings}
      isLoading={isLoading}
      error={
        error ? getApiErrorMessage(error, "We could not load employee onboarding records.") : null
      }
      onRetry={() => {
        void refetch();
      }}
      emptyTitle="No onboarding records"
      emptyDescription="Start an onboarding workflow when a new employee is ready."
      onRowClick={(onboarding: EmployeeOnboarding) =>
        router.push(`/hr/employee-onboarding/${onboarding.id}`)
      }
      getRowLabel={(onboarding) => `Open onboarding ${onboarding.id}`}
    />
  );
}
