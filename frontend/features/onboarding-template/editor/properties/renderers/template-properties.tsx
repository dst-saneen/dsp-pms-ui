"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  useOnboardingDesigner,
} from "../../state";

export function TemplateProperties() {
  const {
    state,
  } = useOnboardingDesigner();

  const template =
    state.workspace.template;
  const taskCount =
  state.workspace.explorer.nodes
    .flatMap(template => template.children ?? [])
    .flatMap(department => department.children ?? [])
    .reduce(
      (count, group) => count + (group.children?.length ?? 0),
      0,
    );

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle>Template Metadata</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Property
          label="Template Name"
          value={template.templateName}
        />

        <Property
          label="Template Code"
          value={template.templateCode}
        />

        <Property
          label="Status"
          value={template.isActive ? "Active" : "Inactive"}
        />

        <Property
          label="Task Count"
          value={String(taskCount)}
        />
      </CardContent>
    </Card>
  );
}

function Property({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>

      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="font-medium">
        {value ?? "-"}
      </p>

    </div>
  );
}