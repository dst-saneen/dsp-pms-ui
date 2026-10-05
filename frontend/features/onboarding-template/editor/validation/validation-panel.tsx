"use client";

import type {
  ValidationResult,
} from "./validation.types";

import {
  ValidationSummary,
} from "./validation-summary";

import {
  ValidationItem,
} from "./validation-item";

interface Props {
  result: ValidationResult;
}

export function ValidationPanel({
  result,
}: Props) {

  return (

    <div className="space-y-4">

      <ValidationSummary
        result={result}
      />

      <div className="space-y-2">

        {result.issues.map(
          (issue) => (

            <ValidationItem
              key={issue.id}
              issue={issue}
            />

          ),
        )}

      </div>

    </div>

  );

}