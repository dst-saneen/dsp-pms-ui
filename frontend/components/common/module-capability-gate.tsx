"use client";

import type { ReactNode } from "react";

import { useModuleCapabilities } from "@/hooks/use-module-capabilities";

type ModuleCapabilityKey =
  | "financeNav"
  | "payrollNav"
  | "projectsNav"
  | "onboardingNav"
  | "assetsNav"
  | "deliveryOperationsNav"
  | "fileOperationsNav"
  | "recruitmentNav";

export function ModuleCapabilityGate({
  capability,
  children,
}: {
  capability: ModuleCapabilityKey;
  children: ReactNode;
}) {
  const { data, isLoading, isPending, isError, error, refetch } = useModuleCapabilities();

  if (isLoading || isPending) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed px-5 py-10 text-center text-sm">
        Checking module availability…
      </div>
    );
  }

  const denied =
    (error as { response?: { status?: number } } | null)?.response?.status === 403;

  if (denied) {
    return (
      <div
        className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-5 py-10 text-center text-sm"
        role="alert"
      >
        You do not have permission to access this module.
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-5 py-10 text-center text-sm"
        role="alert"
      >
        <p>Module availability could not be checked. This area is temporarily degraded.</p>
        <button
          type="button"
          className="mt-2 font-semibold underline underline-offset-2"
          onClick={() => void refetch()}
        >
          Retry module check
        </button>
      </div>
    );
  }

  if (!data?.[capability]) {
    const message =
      capability === "assetsNav"
        ? "Assets & licences are unavailable for this Company or your role. Ask a Company Administrator to enable the company module or update your access."
        : capability === "projectsNav"
          ? "Projects is unavailable for this Company or your role. Ask a Company Administrator to enable the company module or update your access."
          : capability === "financeNav"
            ? "Office Finance is unavailable for this Company or your role. Ask a Company Administrator to enable the company module or grant the required finance access."
            : capability === "payrollNav"
              ? "Payroll is unavailable for this Company or your role. Check Office Finance and file storage setup, then ask a Company Administrator to enable the company module or update your access."
                : capability === "deliveryOperationsNav"
                  ? "You lack delivery read permission (platform.delivery.read or hr.recruitment.delivery.read). Ask an admin to grant Delivery Operations access. Delivery Operations may still be unavailable — the queue page will say so."
                : capability === "fileOperationsNav"
                  ? "File Operations is unavailable for this Company or your role. Ask a Company Administrator to enable the company module or grant files.operations.read."
                  : "This module is not enabled for the active Company and Branch.";
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed px-5 py-10 text-center text-sm">
        {message}
      </div>
    );
  }

  return <>{children}</>;
}
