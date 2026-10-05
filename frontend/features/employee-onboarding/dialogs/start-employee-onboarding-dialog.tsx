"use client";

import { FormSheet } from "@/components/common/form-sheet";

import { StartEmployeeOnboardingForm } from "../forms/start-employee-onboarding-form";

interface StartEmployeeOnboardingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultEmployeeId?: string;
}

export function StartEmployeeOnboardingDialog({
  open,
  onOpenChange,
  defaultEmployeeId,
}: StartEmployeeOnboardingDialogProps) {
  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Start Employee Onboarding"
      description="Assign a published onboarding template to an employee."
      size="lg"
    >
      <StartEmployeeOnboardingForm
        defaultEmployeeId={defaultEmployeeId}
        onSuccess={() => onOpenChange(false)}
        onCancel={() => onOpenChange(false)}
      />
    </FormSheet>
  );
}
