"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";

import { CompanyGroupService } from "@/features/company-group/services/company-group-service";
import { CompanyService } from "@/features/company/services/company-service";
import { BranchService } from "@/features/branch/services/branch-service";
import { DepartmentService } from "@/features/department/services/department-service";
import { DesignationService } from "@/features/designation/services/designation-service";
import { ShiftService } from "@/features/shift/services/shift-service";
import { cn } from "@/lib/utils";

interface ReadinessStep {
  id: string;
  label: string;
  href: string;
  description: string;
  done: boolean;
  required: boolean;
}

/**
 * ADM-01 — lightweight admin structure checklist.
 * Points at existing administration routes; does not invent a new workflow.
 */
export function AdminStructureReadiness({
  className,
}: {
  className?: string;
}) {
  const results = useQueries({
    queries: [
      {
        queryKey: ["admin-readiness", "company-groups"],
        queryFn: () => CompanyGroupService.getAll(),
        staleTime: 60_000,
      },
      {
        queryKey: ["admin-readiness", "companies"],
        queryFn: () => CompanyService.getAll(),
        staleTime: 60_000,
      },
      {
        queryKey: ["admin-readiness", "branches"],
        queryFn: () => BranchService.getBranches(),
        staleTime: 60_000,
      },
      {
        queryKey: ["admin-readiness", "departments"],
        queryFn: () => DepartmentService.getDepartments(),
        staleTime: 60_000,
      },
      {
        queryKey: ["admin-readiness", "designations"],
        queryFn: () => DesignationService.getDesignations(),
        staleTime: 60_000,
      },
      {
        queryKey: ["admin-readiness", "shifts"],
        queryFn: () => ShiftService.getShifts(),
        staleTime: 60_000,
      },
    ],
  });

  const [
    groupsQuery,
    companiesQuery,
    branchesQuery,
    departmentsQuery,
    designationsQuery,
    shiftsQuery,
  ] = results;

  const steps: ReadinessStep[] = [
    {
      id: "company-groups",
      label: "Company Group",
      href: "/administration/company-groups",
      description: "Top-level organization container",
      done: (groupsQuery.data?.length ?? 0) > 0,
      required: true,
    },
    {
      id: "companies",
      label: "Company",
      href: "/administration/companies",
      description: "Legal entity under a group",
      done: (companiesQuery.data?.length ?? 0) > 0,
      required: true,
    },
    {
      id: "branches",
      label: "Branch",
      href: "/administration/branches",
      description: "Operating location under a company",
      done: (branchesQuery.data?.length ?? 0) > 0,
      required: true,
    },
    {
      id: "departments",
      label: "Department",
      href: "/administration/departments",
      description: "Team under a branch",
      done: (departmentsQuery.data?.length ?? 0) > 0,
      required: true,
    },
    {
      id: "designations",
      label: "Designation",
      href: "/administration/designations",
      description: "Job titles for the structure",
      done: (designationsQuery.data?.length ?? 0) > 0,
      required: false,
    },
    {
      id: "shifts",
      label: "Shift",
      href: "/administration/shifts",
      description: "Default working hours",
      done: (shiftsQuery.data?.length ?? 0) > 0,
      required: false,
    },
    {
      id: "calendar",
      label: "Business Calendar",
      href: "/administration/business-calendar",
      description: "Holidays and working-day rules",
      done: true,
      required: false,
    },
  ];

  const nextStep =
    steps.find((step) => step.required && !step.done) ??
    steps.find((step) => !step.done);

  const loading = results.some((query) => query.isLoading);

  return (
    <section
      className={cn(
        "border-border bg-card rounded-xl border px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
      aria-label="Organization structure readiness"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Structure readiness
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {loading
              ? "Checking masters…"
              : nextStep
                ? `Next: ${nextStep.label} — ${nextStep.description}`
                : "Core structure masters look ready."}
          </p>
        </div>
        {nextStep && !loading ? (
          <Link
            href={
              nextStep.id === "companies"
                ? "/administration/companies/new"
                : nextStep.id === "branches"
                  ? "/administration/branches/new"
                  : nextStep.id === "departments"
                    ? "/administration/departments/new"
                    : nextStep.id === "designations"
                      ? "/administration/designations/new"
                      : nextStep.href
            }
            className="text-primary inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline"
          >
            Continue setup
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <ol className="mt-3 flex flex-wrap gap-2">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                step.done
                  ? "border-success/20 bg-success-soft text-success"
                  : step.required
                    ? "border-warning/25 bg-warning-soft text-warning-foreground"
                    : "border-border bg-muted/40 text-muted-foreground",
              )}
            >
              {step.done ? (
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
              ) : (
                <Circle className="size-3.5" aria-hidden="true" />
              )}
              {step.label}
              {!step.required ? (
                <span className="opacity-70">(optional)</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
