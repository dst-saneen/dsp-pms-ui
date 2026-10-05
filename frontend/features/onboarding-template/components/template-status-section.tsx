"use client";

import { UseFormReturn } from "react-hook-form";

import { Switch } from "@/components/ui/switch";

import type { OnboardingTemplateFormValues } from "../validation/onboarding-template-schema";

interface Props {
  form: UseFormReturn<OnboardingTemplateFormValues>;
}

export function TemplateStatusSection({ form }: Props) {
  return (
    <div className="border-border bg-card flex items-center justify-between rounded-xl border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_18px_rgba(16,24,40,0.03)] sm:p-5">
      <div>
        <div className="font-medium">Active</div>

        <div className="text-muted-foreground text-sm">
          Template is available for employee onboarding.
        </div>
      </div>

      <Switch
        checked={form.watch("isActive")}
        onCheckedChange={(value) => form.setValue("isActive", value)}
      />
    </div>
  );
}
