"use client";

import type {
  ValidationIssue,
} from "./validation.types";

interface Props {
  issue: ValidationIssue;
}

export function ValidationItem({
  issue,
}: Props) {

  return (

    <div className="rounded-lg border p-3">

      <div className="font-medium">

        {issue.title}

      </div>

      <div className="text-sm text-muted-foreground">

        {issue.message}

      </div>

    </div>

  );

}