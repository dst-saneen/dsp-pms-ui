"use client";

import { UseFormReturn } from "react-hook-form";

import {
  GeneralInformationSection,
  TemplateStatusSection,
} from "../components";

import type {
  OnboardingTemplateFormValues,
} from "../validation/onboarding-template-schema";

interface Props {
  form: UseFormReturn<OnboardingTemplateFormValues>;
}

export function OnboardingTemplateFields({
  form,
}: Props) {
  return (
    <>
      <GeneralInformationSection
        form={form}
      />

      <TemplateStatusSection
        form={form}
      />
    </>
  );
}