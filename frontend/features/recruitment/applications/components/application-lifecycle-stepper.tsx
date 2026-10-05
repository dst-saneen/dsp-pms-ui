"use client";

import { cn } from "@/lib/utils";

import { JOB_APPLICATION_STATUS, type JobApplicationStatus } from "../../types/enums";
import {
  APPLICATION_LIFECYCLE_STEPS,
  formatApplicationStatusLabel,
  isTerminalApplicationStatus,
} from "../utils/application-actions";

interface ApplicationLifecycleStepperProps {
  status: JobApplicationStatus;
}

export function ApplicationLifecycleStepper({
  status,
}: ApplicationLifecycleStepperProps) {
  const terminal = isTerminalApplicationStatus(status);
  const currentIndex = APPLICATION_LIFECYCLE_STEPS.indexOf(status);

  return (
    <div className="space-y-3">
      <ol className="flex flex-wrap gap-2" aria-label="Application lifecycle">
        {APPLICATION_LIFECYCLE_STEPS.map((step, index) => {
          const isCurrent = step === status;
          const isComplete =
            !terminal && currentIndex >= 0 && index < currentIndex;
          return (
            <li key={step}>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                  isCurrent && "border-primary bg-primary/5 text-primary",
                  isComplete && "border-success/40 bg-success/5 text-success",
                  !isCurrent && !isComplete && "text-muted-foreground",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                {formatApplicationStatusLabel(step)}
              </span>
            </li>
          );
        })}
      </ol>

      {terminal && status !== JOB_APPLICATION_STATUS.HIRED ? (
        <p className="text-muted-foreground text-sm" role="status">
          Side exit: {formatApplicationStatusLabel(status)}
        </p>
      ) : null}
    </div>
  );
}
