"use client";

import { useEffect } from "react";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  branchSchema,
  type BranchFormValues,
} from "../validation/branch-schema";

import type { Branch } from "../types/branch";

import {
  MasterFormLayout,
  LookupSelect,
  RequiredLabel,
} from "@/components/forms";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { useCompanies } from "@/features/lookups/hooks/use-companies";

const emptyValues: BranchFormValues = {
  companyId: "",
  branchName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  countryCode: "",
  countrySubdivisionCode: "",
  timezone: "",
  isActive: true,
};

interface BranchFormProps {
  branch?: Branch | null;

  onSubmit: (
    data: BranchFormValues,
  ) => void;

  onCancel?: () => void;

  isSaving?: boolean;

  defaultCompanyId?: string;

  onDirtyChange?: (isDirty: boolean) => void;

  onInvalid?: (messages: string[]) => void;
}

export function BranchForm({
  branch,
  onSubmit,
  defaultCompanyId,
  onDirtyChange,
  onInvalid,
}: BranchFormProps) {
  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchSchema),

    defaultValues: {
      ...emptyValues,
      companyId: defaultCompanyId ?? "",
    },
  });

  const {
    data: companies = [],
    isLoading: companiesLoading,
  } = useCompanies();

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  useEffect(() => {
    if (!branch) {
      form.reset({
        ...emptyValues,
        companyId: defaultCompanyId ?? "",
      });
      return;
    }

    form.reset({
      companyId: branch.companyId,
      branchName: branch.branchName,
      addressLine1: branch.addressLine1 ?? "",
      addressLine2: branch.addressLine2 ?? "",
      city: branch.city ?? "",
      state: branch.state ?? "",
      postalCode: branch.postalCode ?? "",
      countryCode: branch.countryCode ?? "",
      countrySubdivisionCode: branch.countrySubdivisionCode ?? "",
      timezone: branch.timezone ?? "",
      isActive: branch.isActive ?? true,
    });
  }, [branch, defaultCompanyId, form]);

  return (
    <form
      id="branch-form"
      onSubmit={form.handleSubmit(onSubmit, (errors) => {
        const messages = Object.values(errors)
          .map((error) => error?.message)
          .filter((message): message is string => Boolean(message));
        onInvalid?.(messages);
      })}
      className="space-y-6"
    >
      <MasterFormLayout>

        {/* Company */}
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

        {/* Branch Name */}
        <div className="space-y-2">
          <RequiredLabel required>
            Branch Name
          </RequiredLabel>

          <Input
            {...form.register("branchName")}
            placeholder="Branch Name"
          />
        </div>

        {/* Address Line 1 */}
        <div className="space-y-2">
          <RequiredLabel>
            Address Line 1
          </RequiredLabel>

          <Input
            {...form.register("addressLine1")}
            placeholder="Address Line 1"
          />
        </div>

        {/* Address Line 2 */}
        <div className="space-y-2">
          <RequiredLabel>
            Address Line 2
          </RequiredLabel>

          <Input
            {...form.register("addressLine2")}
            placeholder="Address Line 2"
          />
        </div>

        {/* City */}
        <div className="space-y-2">
          <RequiredLabel>
            City
          </RequiredLabel>

          <Input
            {...form.register("city")}
            placeholder="City"
          />
        </div>

        {/* State */}
        <div className="space-y-2">
          <RequiredLabel>
            State
          </RequiredLabel>

          <Input
            {...form.register("state")}
            placeholder="State"
          />
        </div>

        {/* Postal Code */}
        <div className="space-y-2">
          <RequiredLabel>
            Postal Code
          </RequiredLabel>

          <Input
            {...form.register("postalCode")}
            placeholder="Postal Code"
          />
        </div>

        {/* Country Code */}
        <div className="space-y-2">
          <RequiredLabel required>
            Country Code
          </RequiredLabel>

          <Input
            {...form.register("countryCode")}
            placeholder="e.g. IN"
            maxLength={2}
            className="uppercase"
          />
          {form.formState.errors.countryCode && (
            <p className="text-destructive text-sm">
              {form.formState.errors.countryCode.message}
            </p>
          )}
        </div>

        {/* Country subdivision */}
        <div className="space-y-2">
          <RequiredLabel required>
            Country Subdivision Code
          </RequiredLabel>

          <Input
            {...form.register("countrySubdivisionCode")}
            placeholder="e.g. IN-KL"
            maxLength={6}
            className="uppercase"
          />
          {form.formState.errors.countrySubdivisionCode && (
            <p className="text-destructive text-sm">
              {form.formState.errors.countrySubdivisionCode.message}
            </p>
          )}
        </div>

        {/* Timezone */}
        <div className="space-y-2 md:col-span-2">
          <RequiredLabel required>
            Timezone
          </RequiredLabel>

          <Input
            {...form.register("timezone")}
            placeholder="e.g. Asia/Kolkata"
          />
          {form.formState.errors.timezone && (
            <p className="text-destructive text-sm">
              {form.formState.errors.timezone.message}
            </p>
          )}
        </div>

        {/* Active */}
        <div className="space-y-2 md:col-span-2">
          <RequiredLabel>Active</RequiredLabel>

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
              Enable this branch
            </span>
          </div>
        </div>

      </MasterFormLayout>
    </form>
  );
}
