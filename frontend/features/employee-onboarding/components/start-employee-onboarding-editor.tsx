"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { EntityFormPage } from "@/components/common/entity-form-page";
import { Button } from "@/components/ui/button";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";

import { StartEmployeeOnboardingForm } from "../forms/start-employee-onboarding-form";
import {
  EMPLOYEE_ONBOARDING_LIST,
  ONBOARDING_TEMPLATES,
} from "../lib/start-onboarding-navigation";

const FORM_ID = "start-employee-onboarding-form";

interface StartEmployeeOnboardingEditorProps {
  defaultEmployeeId?: string;
  returnTo: string;
}

export function StartEmployeeOnboardingEditor({
  defaultEmployeeId,
  returnTo,
}: StartEmployeeOnboardingEditorProps) {
  const router = useRouter();
  const [isDirty, setIsDirty] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([
    { label: "Start Onboarding", href: null },
  ]);

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(returnTo);
  }, [confirmLeave, returnTo, router]);

  return (
    <EntityFormPage
      title="Start Employee Onboarding"
      description="Resolve the published template from the employee designation, review blockers, then start once."
      formId={FORM_ID}
      primaryLabel="Start Onboarding"
      secondaryLabel="Cancel"
      onSecondary={goBack}
      isSaving={isPending}
      primaryDisabled={!canSubmit}
      headerActions={
        <Button asChild variant="outline" size="sm">
          <Link href={ONBOARDING_TEMPLATES}>Onboarding Templates</Link>
        </Button>
      }
    >
      <StartEmployeeOnboardingForm
        formId={FORM_ID}
        hideActions
        defaultEmployeeId={defaultEmployeeId}
        onCancel={goBack}
        onDirtyChange={setIsDirty}
        onCanSubmitChange={setCanSubmit}
        onPendingChange={setIsPending}
        onSuccess={() => {
          // Navigation to detail happens inside the form mutation.
        }}
      />
      <p className="text-muted-foreground mt-4 text-xs">
        Cancel returns to{" "}
        <Link href={returnTo || EMPLOYEE_ONBOARDING_LIST} className="underline">
          the previous list
        </Link>
        .
      </p>
    </EntityFormPage>
  );
}
