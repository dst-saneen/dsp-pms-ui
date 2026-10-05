"use client";

import { Controller, UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  LookupSelect,
} from "@/components/forms/lookup-select";

import {
  FormSection,
  RequiredLabel,
} from "@/components/forms";

import {
  useCompanies,
} from "@/features/lookups/hooks/use-companies";

import {
  useDepartments,
} from "@/features/lookups/hooks/use-departments";

import type {
  OnboardingTemplateFormValues,
} from "../validation/onboarding-template-schema";

interface Props {
  form: UseFormReturn<OnboardingTemplateFormValues>;
}

export function GeneralInformationSection({
  form,
}: Props) {
  const {
    data: companies = [],
    isLoading: companiesLoading,
  } = useCompanies();

  const {
    data: departments = [],
    isLoading: departmentsLoading,
  } = useDepartments();

  return (
    <FormSection title="General Information">
      <div className="grid gap-4 md:grid-cols-3">

        <div className="space-y-2">
          <RequiredLabel required>
            Company
          </RequiredLabel>

          <Controller
            control={form.control}
            name="companyId"
            render={({ field }) => (
              <LookupSelect
                value={field.value}
                onChange={field.onChange}
                items={companies}
                placeholder="Select Company"
                loading={companiesLoading}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel required>
            Department
          </RequiredLabel>

          <Controller
            control={form.control}
            name="departmentId"
            render={({ field }) => (
              <LookupSelect
                value={field.value}
                onChange={field.onChange}
                items={departments}
                placeholder="Select Department"
                loading={departmentsLoading}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel required>
            Template Code
          </RequiredLabel>

          <Input
            {...form.register("templateCode")}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <RequiredLabel required>
            Template Name
          </RequiredLabel>

          <Input
            {...form.register("templateName")}
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <label className="text-sm font-medium">
          Description
        </label>

        <Textarea
          rows={4}
          {...form.register("description")}
        />
      </div>
    </FormSection>
  );
}