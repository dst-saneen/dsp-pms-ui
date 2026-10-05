"use client";

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { AuthzState } from "@/components/common/authz-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DepartmentEditor } from "@/features/department/components/department-editor";
import { useDepartment } from "@/features/department/hooks/use-department";
import {
  DEPARTMENT_LIST,
  resolveDepartmentReturnPath,
} from "@/features/department/lib/department-navigation";
import { useAuth } from "@/providers/auth-provider";

function DepartmentEditContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const { hasPermission } = useAuth();
  const canManage = hasPermission("organization.structure.manage");
  const canRead = hasPermission("organization.structure.read") || canManage;
  const returnTo = resolveDepartmentReturnPath(
    searchParams.get("return"),
    DEPARTMENT_LIST,
  );
  const { data: department, isLoading, isError } = useDepartment(id);

  if (!canRead) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot view this department"
          description="You need organization.structure.read to open department details."
          actionLabel="Back to departments"
          onAction={() => router.push(DEPARTMENT_LIST)}
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Edit Department" description="Loading department…" />
        <Skeleton className="h-64 rounded-xl" />
      </PageContainer>
    );
  }

  if (isError || !department) {
    return (
      <PageContainer>
        <AuthzState
          variant="not-found"
          title="Department not found"
          description="This department may have been deleted or is outside your organization scope."
          actionLabel="Back to departments"
          onAction={() => router.push(DEPARTMENT_LIST)}
        />
      </PageContainer>
    );
  }

  if (!canManage) {
    return (
      <PageContainer>
        <AuthzState
          variant="unauthorized"
          title="Cannot edit departments"
          description="You can view the list, but organization.structure.manage is required to edit."
          actionLabel="Back to departments"
          onAction={() => router.push(DEPARTMENT_LIST)}
        />
      </PageContainer>
    );
  }

  return (
    <DepartmentEditor
      mode="edit"
      department={department}
      returnTo={returnTo}
      canManage={canManage}
    />
  );
}

export default function DepartmentEditPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <DepartmentEditContent />
    </Suspense>
  );
}
