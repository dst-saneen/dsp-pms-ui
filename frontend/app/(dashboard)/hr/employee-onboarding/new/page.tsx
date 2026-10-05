"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";
import { PageContainer } from "@/components/common/page-container";
import { PermissionGate } from "@/components/common/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { StartEmployeeOnboardingEditor } from "@/features/employee-onboarding/components/start-employee-onboarding-editor";
import { resolveStartOnboardingReturnPath } from "@/features/employee-onboarding/lib/start-onboarding-navigation";

function StartEmployeeOnboardingContent() {
  const searchParams = useSearchParams();
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const returnTo = resolveStartOnboardingReturnPath(searchParams.get("return"));

  return (
    <PermissionGate
      permission="hr.onboarding.manage"
      fallback="unauthorized"
      unauthorizedTitle="Cannot start onboarding"
      unauthorizedDescription="You need hr.onboarding.manage to start employee onboarding."
    >
      <ModuleCapabilityGate capability="onboardingNav">
        <StartEmployeeOnboardingEditor
          defaultEmployeeId={employeeId}
          returnTo={returnTo}
        />
      </ModuleCapabilityGate>
    </PermissionGate>
  );
}

export default function StartEmployeeOnboardingPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 rounded-xl" />
        </PageContainer>
      }
    >
      <StartEmployeeOnboardingContent />
    </Suspense>
  );
}
