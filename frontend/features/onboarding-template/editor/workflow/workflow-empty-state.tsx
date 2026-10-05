"use client";

export function WorkflowEmptyState() {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">

      <h3 className="text-lg font-medium">
        No Workflow Defined
      </h3>

      <p className="mt-2 text-sm text-muted-foreground">
        Create your first onboarding stage to begin
        designing this template.
      </p>

    </div>
  );
}