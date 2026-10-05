"use client";

import { UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";

import {
  FormSection,
  RequiredLabel,
} from "@/components/forms";

import type { EmployeeFormValues } from "../../validation/employee-schema";

interface PersonalInformationSectionProps {
  form: UseFormReturn<EmployeeFormValues>;
}

export function PersonalInformationSection({
  form,
}: PersonalInformationSectionProps) {
  return (
    <FormSection title="Personal Information">
      <div className="grid gap-4 md:grid-cols-2">

        <div className="space-y-2">
          <RequiredLabel htmlFor="employee-first-name" required>
            First Name
          </RequiredLabel>

          <Input
            id="employee-first-name"
            placeholder="Enter First Name"
            {...form.register("firstName")}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel htmlFor="employee-last-name">
            Last Name
          </RequiredLabel>

          <Input
            id="employee-last-name"
            placeholder="Enter Last Name"
            {...form.register("lastName")}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel htmlFor="employee-email">
            Email
          </RequiredLabel>

          <Input
            id="employee-email"
            type="email"
            placeholder="Enter Email"
            {...form.register("email")}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel htmlFor="employee-mobile">
            Mobile
          </RequiredLabel>

          <Input
            id="employee-mobile"
            placeholder="Enter Mobile Number"
            {...form.register("mobile")}
          />
        </div>

      </div>
    </FormSection>
  );
}
