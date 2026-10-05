"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { EmployeeEditor } from "@/features/employee";
import { EmployeeDetailLoading } from "@/features/employee/editor/employee-detail-loading";
import { resolveEmployeeReturnPath } from "@/features/employee/lib/employee-navigation";

function EmployeeDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const tab = searchParams.get("tab") ?? undefined;
  const returnTo = resolveEmployeeReturnPath(searchParams.get("return"));

  const allowedTabs = new Set([
    "overview",
    "employment",
    "documents",
    "assets",
    "onboarding",
    "career",
    "leave",
    "salary",
  ]);
  const defaultTab = tab && allowedTabs.has(tab) ? tab : undefined;

  return (
    <EmployeeEditor
      employeeId={id}
      defaultTab={defaultTab}
      listReturnTo={returnTo}
    />
  );
}

export default function EmployeePage() {
  return (
    <Suspense fallback={<EmployeeDetailLoading />}>
      <EmployeeDetailContent />
    </Suspense>
  );
}
