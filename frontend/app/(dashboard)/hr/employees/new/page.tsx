"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeFormEditor } from "@/features/employee/forms/employee-form-editor";
import {
  EMPLOYEE_LIST,
  resolveEmployeeReturnPath,
} from "@/features/employee/lib/employee-navigation";
import { useAuth } from "@/providers/auth-provider";

function NewEmployeeContent() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const returnTo = resolveEmployeeReturnPath(
    searchParams.get("return"),
    EMPLOYEE_LIST,
  );
  const canManage = hasPermission("hr.employees.manage");

  return (
    <PermissionGate
      permission="hr.employees.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot add employees"
      unauthorizedDescription="You need hr.employees.manage to create an employee record."
    >
      <EmployeeFormEditor
        mode="create"
        returnTo={returnTo}
        canManage={canManage}
      />
    </PermissionGate>
  );
}

export default function NewEmployeePage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <NewEmployeeContent />
    </Suspense>
  );
}
