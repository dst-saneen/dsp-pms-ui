"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AuthzState } from "@/components/common/authz-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { EmployeeFormEditor } from "@/features/employee/forms/employee-form-editor";
import { useEmployee } from "@/features/employee/hooks";
import {
  EMPLOYEE_LIST,
  employeeDetailHref,
  resolveEmployeeReturnPath,
} from "@/features/employee/lib/employee-navigation";
import { useAuth } from "@/providers/auth-provider";

function EmployeeEditContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasPermission } = useAuth();
  const canManage = hasPermission("hr.employees.manage");
  const canRead = hasPermission("hr.employees.read") || canManage;
  const returnTo = resolveEmployeeReturnPath(
    searchParams.get("return"),
    employeeDetailHref(id),
  );
  const { data: employee, isLoading, isError } = useEmployee(id);

  if (!canRead) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot view this employee"
          description="You need hr.employees.read to open employee details."
          actionLabel="Back to employees"
          onAction={() => router.push(EMPLOYEE_LIST)}
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Edit Employee" description="Loading…" />
        <Skeleton className="h-64 rounded-xl" />
      </PageContainer>
    );
  }

  if (isError || !employee) {
    return (
      <PageContainer>
        <AuthzState
          variant="not-found"
          title="Employee not found"
          description="This employee may have been removed or is outside your scope."
          actionLabel="Back to employees"
          onAction={() => router.push(EMPLOYEE_LIST)}
        />
      </PageContainer>
    );
  }

  return (
    <PermissionGate
      permission="hr.employees.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot edit employees"
      unauthorizedDescription="You need hr.employees.manage to edit employee records."
    >
      <EmployeeFormEditor
        mode="edit"
        employee={employee}
        returnTo={returnTo}
        canManage={canManage}
      />
    </PermissionGate>
  );
}

export default function EmployeeEditPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <EmployeeEditContent />
    </Suspense>
  );
}
