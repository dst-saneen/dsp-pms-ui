"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  onboardingTemplateSchema,
  type OnboardingTemplateFormValues,
} from "../validation/onboarding-template-schema";

import { OnboardingTemplateFields } from "./onboarding-template-fields";

import type { CreateOnboardingTemplate, OnboardingTemplate } from "../types";

import { Button } from "@/components/ui/button";

const defaultValues: OnboardingTemplateFormValues = {
  companyId: "",
  departmentId: "",
  templateCode: "",
  templateName: "",
  description: "",
  isActive: true,
};

interface Props {
  template?: OnboardingTemplate;
  submitLabel?: string;

  onSubmit: (
    values: CreateOnboardingTemplate & {
      isActive: boolean;
    }
  ) => void;
}

export function OnboardingTemplateForm({
  template,
  submitLabel = "Save Changes",
  onSubmit,
}: Props) {
  const form = useForm<OnboardingTemplateFormValues>({
    resolver: zodResolver(onboardingTemplateSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!template) {
      form.reset(defaultValues);

      return;
    }

    form.reset({
      companyId: template.companyId,

      departmentId: template.departmentId,

      templateCode: template.templateCode,

      templateName: template.templateName,

      description: template.description ?? "",

      isActive: template.isActive,
    });
  }, [template, form]);

  return (
    <form
      id="onboarding-template-form"
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="space-y-5"
    >
      <OnboardingTemplateFields form={form} />

      <div className="border-border bg-card flex justify-end rounded-xl border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_18px_rgba(16,24,40,0.03)]">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
