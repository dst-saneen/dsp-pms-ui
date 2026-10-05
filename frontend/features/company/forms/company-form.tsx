"use client";

import { useEffect } from "react";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { companySchema } from "../validation/company-schema";

import type { Company } from "../types/company";

import {
  MasterFormLayout,
  LookupSelect,
  RequiredLabel,
} from "@/components/forms";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { useCompanyGroups } from "@/features/lookups/hooks/use-company-groups";
import { useCompanies } from "@/features/lookups/hooks/use-companies";

type CompanyFormValues = z.infer<
  typeof companySchema
>;

interface CompanyFormProps {
  company?: Company | null;

  onSubmit: (
    data: CompanyFormValues,
  ) => void;

  onCancel?: () => void;

  isSaving?: boolean;

  onDirtyChange?: (isDirty: boolean) => void;

  onInvalid?: (messages: string[]) => void;
}

export function CompanyForm({
  company,
  onSubmit,
  onDirtyChange,
  onInvalid,
}: CompanyFormProps) {
    const form = useForm({
        resolver: zodResolver(companySchema),

        defaultValues: {
            companyGroupId: "",
            parentCompanyId: "",

            companyName: "",

            registrationNo: "",
            taxNumber: "",
            legalCountryCode: "",

            isActive: true,
        },
    });

    const {
        data: companyGroups = [],
        isLoading: companyGroupsLoading,
        } = useCompanyGroups();

    const {
        data: companies = [],
        isLoading: companiesLoading,
        } = useCompanies();

    const parentCompanies =
        companies.filter(
            (item) => item.id !== company?.id,
    );

    useEffect(() => {
        onDirtyChange?.(form.formState.isDirty);
    }, [form.formState.isDirty, onDirtyChange]);

    useEffect(() => {
        if (!company) {
            form.reset();
            return;
        }

        form.reset({
            companyGroupId:
            company.companyGroupId ?? company.companyGroup?.id ?? "",

            parentCompanyId:
            company.parentCompanyId ?? "",

            companyName:
            company.companyName,

            registrationNo:
            company.registrationNo ?? "",

            taxNumber:
            company.taxNumber ?? "",

            legalCountryCode:
            company.legalCountryCode ?? "",

            isActive:
            company.isActive,
        });
    }, [company, form]);

   return (
    <form
        id="company-form"
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          const messages = Object.values(errors)
            .map((error) => error?.message)
            .filter((message): message is string => Boolean(message));
          onInvalid?.(messages);
        })}
        className="space-y-6"
    >
        <MasterFormLayout>

        {/* Company Group */}
        <div className="space-y-2">
            <RequiredLabel>Company Group</RequiredLabel>

            <Controller
            control={form.control}
            name="companyGroupId"
            render={({ field }) => (
                <LookupSelect
                value={field.value ?? ""}
                onChange={field.onChange}
                items={companyGroups}
                placeholder="Select Company Group"
                loading={companyGroupsLoading}
                />
            )}
            />
        </div>

        {/* Parent Company */}
        <div className="space-y-2">
            <RequiredLabel>Parent Company</RequiredLabel>

            <Controller
            control={form.control}
            name="parentCompanyId"
            render={({ field }) => (
                <LookupSelect
                value={field.value ?? ""}
                onChange={field.onChange}
                items={parentCompanies}
                placeholder="Select Parent Company"
                loading={companiesLoading}
                />
            )}
            />
        </div>

        {/* Company Name */}
        <div className="space-y-2">
            <RequiredLabel required>
            Company Name
            </RequiredLabel>

            <Input
            {...form.register("companyName")}
            placeholder="Company Name"
            />
        </div>

        {/* Registration Number */}
        <div className="space-y-2">
            <RequiredLabel>
            Registration Number
            </RequiredLabel>

            <Input
            {...form.register("registrationNo")}
            placeholder="Registration Number"
            />
        </div>

        {/* Tax Number */}
        <div className="space-y-2">
            <RequiredLabel>
            Tax Number
            </RequiredLabel>

            <Input
            {...form.register("taxNumber")}
            placeholder="Tax Number"
            />
        </div>

        {/* Legal Country */}
        <div className="space-y-2">
            <RequiredLabel required>
            Legal Country Code
            </RequiredLabel>

            <Input
            {...form.register("legalCountryCode")}
            maxLength={2}
            autoCapitalize="characters"
            placeholder="IN"
            />
            <p className="text-xs text-muted-foreground">
              ISO two-letter code used by country-specific workflows.
            </p>
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
                Enable this company
            </span>
            </div>
        </div>

        </MasterFormLayout>
    </form>
    );
}
