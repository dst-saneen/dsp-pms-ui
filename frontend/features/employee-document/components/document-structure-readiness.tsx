"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";

import { EmployeeDocumentCategoryService } from "@/features/employee-document-category/services/employee-document-category-service";
import { employeeDocumentCategoryCreateHref } from "@/features/employee-document-category/lib/employee-document-category-navigation";
import { EmployeeDocumentTypeService } from "@/features/employee-document-type/services/employee-document-type-service";
import { employeeDocumentTypeCreateHref } from "@/features/employee-document-type/lib/employee-document-type-navigation";
import { EmployeeDocumentService } from "@/features/employee-document/services/employee-document-service";
import { employeeDocumentCreateHref } from "@/features/employee-document/lib/employee-document-navigation";
import { cn } from "@/lib/utils";

interface ReadinessStep {
  id: string;
  label: string;
  href: string;
  createHref: string;
  description: string;
  done: boolean;
  required: boolean;
}

/**
 * DOC-001 — lightweight document structure checklist.
 * Category → Type → Employee Document.
 */
export function DocumentStructureReadiness({
  className,
}: {
  className?: string;
}) {
  const results = useQueries({
    queries: [
      {
        queryKey: ["document-readiness", "categories"],
        queryFn: () =>
          EmployeeDocumentCategoryService.getEmployeeDocumentCategories(),
        staleTime: 60_000,
      },
      {
        queryKey: ["document-readiness", "types"],
        queryFn: () => EmployeeDocumentTypeService.getAll(),
        staleTime: 60_000,
      },
      {
        queryKey: ["document-readiness", "documents"],
        queryFn: () => EmployeeDocumentService.getAll(),
        staleTime: 60_000,
      },
    ],
  });

  const [categoriesQuery, typesQuery, documentsQuery] = results;

  const steps: ReadinessStep[] = [
    {
      id: "categories",
      label: "Category",
      href: "/hr/employee-document-categories",
      createHref: employeeDocumentCategoryCreateHref(),
      description: "Group document requirements",
      done: (categoriesQuery.data?.length ?? 0) > 0,
      required: true,
    },
    {
      id: "types",
      label: "Type",
      href: "/hr/employee-document-types",
      createHref: employeeDocumentTypeCreateHref(),
      description: "Define document templates under a category",
      done: (typesQuery.data?.length ?? 0) > 0,
      required: true,
    },
    {
      id: "documents",
      label: "Employee Document",
      href: "/hr/employee-documents",
      createHref: employeeDocumentCreateHref(),
      description: "Capture employee document records",
      done: (documentsQuery.data?.length ?? 0) > 0,
      required: true,
    },
  ];

  const nextStep = steps.find((step) => step.required && !step.done);

  const loading = results.some((query) => query.isLoading);

  return (
    <section
      className={cn(
        "border-border bg-card rounded-xl border px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
      aria-label="Document structure readiness"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            Document structure readiness
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {loading
              ? "Checking document masters…"
              : nextStep
                ? `Next: ${nextStep.label} — ${nextStep.description}`
                : "Categories, types, and documents look ready."}
          </p>
        </div>
        {nextStep && !loading ? (
          <Link
            href={nextStep.createHref}
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
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
