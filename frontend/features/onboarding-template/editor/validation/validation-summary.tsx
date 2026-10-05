"use client";

import type {
  ValidationResult,
} from "./validation.types";

interface Props {
  result: ValidationResult;
}

export function ValidationSummary({
  result,
}: Props) {

  const errors =
    result.issues.filter(
      (i) =>
        i.severity === "error",
    ).length;

  const warnings =
    result.issues.filter(
      (i) =>
        i.severity === "warning",
    ).length;

  return (

    <div className="rounded-lg border p-4">

      <div className="font-semibold">

        Validation Summary

      </div>

      <div className="mt-2 text-sm">

        Errors: {errors}

      </div>

      <div className="text-sm">

        Warnings: {warnings}

      </div>

    </div>

  );

}