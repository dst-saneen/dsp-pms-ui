"use client";

import { useMemo } from "react";

import type { OnboardingWorkspace } from "../../workspace";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

import { OnboardingDesignerHeader } from "../header";
import { DepartmentTaskDesigner } from "../../department-designer";
import { ValidationPanel, OnboardingValidator } from "../validation";
import { useOnboardingDesigner } from "../state";

interface Props {
  workspace: OnboardingWorkspace;
  /** When true, hide the second Save/Validate/Publish header (parent already shows it). */
  embedded?: boolean;
}

export function OnboardingDesignerLayout({
  workspace,
  embedded = false,
}: Props) {
  const { state } = useOnboardingDesigner();

  const validation = useMemo(
    () => OnboardingValidator.validate(state.workspace),
    [state.workspace],
  );

  return (
    <div className="flex flex-col gap-3">
      {!embedded ? <OnboardingDesignerHeader /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Employee Onboarding Template</CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-3 gap-4 border-b pb-4">
          <div>
            <p className="text-xs text-muted-foreground">Designation</p>
            <p className="font-medium">
              {workspace.template.templateCode} -{" "}
              {workspace.template.templateName}
            </p>
          </div>

          <div>
            <p className="font-medium">
              {workspace.template.version
                ? `${workspace.template.version.versionName} • ${workspace.template.version.status}`
                : "-"}
            </p>
          </div>
        </CardContent>

        <DepartmentTaskDesigner />
      </Card>

      <Card className="mb-2">
        <ValidationPanel result={validation} />
      </Card>
    </div>
  );
}
