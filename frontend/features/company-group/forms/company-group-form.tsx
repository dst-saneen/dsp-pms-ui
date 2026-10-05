"use client";

import { useEffect } from "react";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import type { CompanyGroup } from "../types/company-group";
import type { CompanyGroupFormValues } from "../validation/company-group-schema";

import { companyGroupSchema } from "../validation/company-group-schema";

import {
  MasterFormLayout,
  RequiredLabel,
} from "@/components/forms";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface CompanyGroupFormProps {
  companyGroup?: CompanyGroup | null;

  onSubmit: (
    data: CompanyGroupFormValues,
  ) => void;

  onCancel?: () => void;

  isSaving?: boolean;
}

export function CompanyGroupForm({
  companyGroup,
  onSubmit,
}: CompanyGroupFormProps) {
  const form = useForm<CompanyGroupFormValues>({
    resolver: zodResolver(companyGroupSchema),

    defaultValues: {
      groupName: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!companyGroup) {
      form.reset();
      return;
    }

    form.reset({
      groupName: companyGroup.groupName,
      isActive: companyGroup.isActive,
    });
  }, [companyGroup, form]);

  return (
    <form
      id="company-group-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <MasterFormLayout>

        {/* Group Name */}
        <div className="space-y-2">
          <RequiredLabel required>
            Group Name
          </RequiredLabel>

          <Input
            {...form.register("groupName")}
            placeholder="Group Name"
          />
        </div>

        {/* Active */}
        <div className="space-y-2 md:col-span-2">
          <RequiredLabel>
            Active
          </RequiredLabel>

          <div className="flex items-center gap-3 rounded-md border px-3 py-2">
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />

            <span className="text-sm text-muted-foreground">
              Enable this company group
            </span>
          </div>
        </div>

      </MasterFormLayout>
    </form>
  );
}
