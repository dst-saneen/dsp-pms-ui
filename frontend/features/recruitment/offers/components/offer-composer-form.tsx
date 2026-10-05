"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { LookupSelect, RequiredLabel } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useManagers } from "@/features/lookups/hooks/use-lookups";
import { EMPLOYMENT_TYPE_OPTIONS } from "../../openings/constants/employment-types";
import { COMPENSATION_PERIOD_OPTIONS } from "../constants/offer-options";
import type { JobOffer } from "../types/job-offer";
import {
  offerDraftSchema,
  type OfferDraftFormValues,
} from "../validation/offer-schema";

interface OfferComposerFormProps {
  offer: JobOffer;
  readOnly?: boolean;
  saving?: boolean;
  onSave: (values: OfferDraftFormValues) => void;
}

export function OfferComposerForm({
  offer,
  readOnly,
  saving,
  onSave,
}: OfferComposerFormProps) {
  const managersQuery = useManagers(offer.organization.companyId);

  const form = useForm<OfferDraftFormValues>({
    resolver: zodResolver(offerDraftSchema),
    values: {
      roleTitle: offer.roleTitle,
      reportingManagerEmployeeId: offer.reportingManagerEmployeeId,
      employmentType: offer.employmentType,
      joiningDate: offer.joiningDate,
      compensationAmount: offer.compensation.amount,
      compensationCurrency: offer.compensation.currency,
      compensationPeriod: offer.compensation.period,
      probationDays: offer.probationDays,
      expiryDate: offer.expiryDate,
      terms: offer.terms ?? "",
    },
  });

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSave)}>
      <div className="rounded-xl border bg-muted/20 p-4 text-sm">
        <p className="font-medium">Organization snapshot</p>
        <p className="mt-1 text-muted-foreground">
          {offer.organization.companyName} · {offer.organization.branchName} ·{" "}
          {offer.organization.departmentName} · {offer.organization.designationName}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <RequiredLabel>Role title</RequiredLabel>
          <Input {...form.register("roleTitle")} disabled={readOnly} />
        </div>
        <div className="space-y-2">
          <RequiredLabel>Reporting manager</RequiredLabel>
          <Controller
            control={form.control}
            name="reportingManagerEmployeeId"
            render={({ field }) => (
              <LookupSelect
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  const manager = managersQuery.data?.find((item) => item.id === value);
                  if (manager) {
                    form.setValue("reportingManagerEmployeeId", manager.id);
                  }
                }}
                items={managersQuery.data ?? []}
                loading={managersQuery.isLoading}
                placeholder="Select reporting manager"
                clearable={false}
                disabled={readOnly}
              />
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <RequiredLabel>Employment type</RequiredLabel>
          <Controller
            control={form.control}
            name="employmentType"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel>Joining date</RequiredLabel>
          <Input type="date" {...form.register("joiningDate")} disabled={readOnly} />
        </div>
        <div className="space-y-2">
          <RequiredLabel>Offer expiry</RequiredLabel>
          <Input type="date" {...form.register("expiryDate")} disabled={readOnly} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2 md:col-span-2">
          <RequiredLabel>Compensation amount</RequiredLabel>
          <Input
            type="number"
            min={0}
            step="0.01"
            {...form.register("compensationAmount", { valueAsNumber: true })}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel>Currency</RequiredLabel>
          <Input
            {...form.register("compensationCurrency")}
            readOnly
            aria-readonly="true"
            className="bg-muted"
          />
          <p className="text-muted-foreground text-xs">
            Set by the Company Financial Profile.
          </p>
        </div>
        <div className="space-y-2">
          <RequiredLabel>Period</RequiredLabel>
          <Controller
            control={form.control}
            name="compensationPeriod"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPENSATION_PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <RequiredLabel>Probation days</RequiredLabel>
        <Input
          type="number"
          min={0}
          {...form.register("probationDays", { valueAsNumber: true })}
          disabled={readOnly}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Offer terms</label>
        <Textarea rows={4} {...form.register("terms")} disabled={readOnly} />
      </div>

      {!readOnly ? (
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save draft"}
        </Button>
      ) : null}
    </form>
  );
}
