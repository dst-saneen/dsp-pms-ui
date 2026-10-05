"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { LookupSelect, RequiredLabel } from "@/components/forms";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompanies } from "@/features/lookups/hooks/use-lookups";

import type { LeaveType } from "../types/leave-type";
import {
  leaveTypeCategoryLabel,
  leaveTypeSchema,
  type LeaveTypeFormValues,
} from "../validation/leave-type-schema";

interface LeaveTypeFormProps {
  leaveType?: LeaveType | null;
  defaultCompanyId?: string;
  onSubmit: (data: LeaveTypeFormValues) => void;
}

export function LeaveTypeForm({ leaveType, defaultCompanyId = "", onSubmit }: LeaveTypeFormProps) {
  const isEdit = Boolean(leaveType);
  const form = useForm<LeaveTypeFormValues>({
    resolver: zodResolver(leaveTypeSchema),
    defaultValues: {
      companyId: defaultCompanyId,
      leaveCode: "",
      leaveName: "",
      description: "",
      category: "STANDARD",
      isPaid: true,
      requiresApproval: true,
      allowHalfDay: false,
      carryForwardAllowed: false,
    },
  });

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const category = useWatch({ control: form.control, name: "category" });
  const isOptionalHoliday = category === "OPTIONAL_HOLIDAY";

  useEffect(() => {
    if (!isOptionalHoliday) return;
    form.setValue("isPaid", true);
    form.setValue("allowHalfDay", false);
    form.setValue("carryForwardAllowed", false);
    // Requires approval stays company-configurable (default true on new types).
    if (!leaveType) {
      form.setValue("requiresApproval", true);
    }
  }, [isOptionalHoliday, leaveType, form]);

  useEffect(() => {
    if (!leaveType) {
      form.reset({
        companyId: defaultCompanyId,
        leaveCode: "",
        leaveName: "",
        description: "",
        category: "STANDARD",
        isPaid: true,
        requiresApproval: true,
        allowHalfDay: false,
        carryForwardAllowed: false,
      });
      return;
    }

    form.reset({
      companyId: leaveType.companyId,
      leaveCode: leaveType.leaveCode,
      leaveName: leaveType.leaveName,
      description: leaveType.description ?? "",
      category: leaveType.category ?? "STANDARD",
      isPaid: leaveType.isPaid,
      requiresApproval: leaveType.requiresApproval,
      allowHalfDay: leaveType.allowHalfDay,
      carryForwardAllowed: leaveType.carryForwardAllowed,
    });
  }, [leaveType, defaultCompanyId, form]);

  return (
    <form id="leave-type-form" className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-2">
        <RequiredLabel required>Company</RequiredLabel>
        <Controller
          control={form.control}
          name="companyId"
          render={({ field }) => (
            <LookupSelect
              value={field.value}
              onChange={field.onChange}
              items={companies}
              loading={companiesLoading}
              placeholder="Select company"
              clearable={false}
              disabled={isEdit}
            />
          )}
        />
        {isEdit ? (
          <p className="text-muted-foreground text-xs">
            Leave types stay on the company they were created for.
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            This leave type will only be available for the selected company.
          </p>
        )}
        {form.formState.errors.companyId ? (
          <p className="text-destructive text-xs">{form.formState.errors.companyId.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <RequiredLabel required>Name</RequiredLabel>
        <Input
          id="leaveName"
          placeholder="e.g. Casual Leave or Comp-off"
          {...form.register("leaveName")}
        />
        {form.formState.errors.leaveName ? (
          <p className="text-destructive text-xs">{form.formState.errors.leaveName.message}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {isEdit
              ? `Code: ${leaveType?.leaveCode ?? "—"}`
              : "Name can be any wording. A short code is created automatically (e.g. Casual Leave → CL)."}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <RequiredLabel required>Kind</RequiredLabel>
        <Controller
          control={form.control}
          name="category"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STANDARD">
                  {leaveTypeCategoryLabel("STANDARD")} — normal leave (Casual, Sick…)
                </SelectItem>
                <SelectItem value="COMP_OFF">
                  {leaveTypeCategoryLabel("COMP_OFF")} — uses overtime credits
                </SelectItem>
                <SelectItem value="UNPAID">
                  {leaveTypeCategoryLabel("UNPAID")} — unpaid leave
                </SelectItem>
                <SelectItem value="OPTIONAL_HOLIDAY">
                  {leaveTypeCategoryLabel("OPTIONAL_HOLIDAY")} — floating
                  holiday picks (paid, no half-day; approval is optional)
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-muted-foreground text-xs">
          Spelling of the name does not matter. For overtime credits to work, choose{" "}
          <span className="text-foreground font-medium">Comp-off</span> here.
          {category === "COMP_OFF"
            ? " After overtime is approved as Comp-off settlement, employees spend credits with this leave type."
            : ""}
          {category === "OPTIONAL_HOLIDAY"
            ? " Link this leave type on Business Calendar → Annual holiday policy. Turn Requires approval on if manager/HR must approve picks; off = auto-approve."
            : ""}
        </p>
        {form.formState.errors.category ? (
          <p className="text-destructive text-xs">{form.formState.errors.category.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="description">
          Description
        </label>
        <Textarea
          id="description"
          placeholder="Optional notes"
          rows={3}
          {...form.register("description")}
        />
      </div>

      <div className="border-border space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Rules</p>
        <div className="divide-border divide-y">
          {(
            [
              ["isPaid", "Paid leave", null],
              ["requiresApproval", "Requires approval", null],
              ["allowHalfDay", "Allow half day", null],
              [
                "carryForwardAllowed",
                "Carry forward allowed",
                "Master switch only. Off = unused days never move to next year (even if Policies has a number like 5). On = when you Generate balances for a new year, unused days can move, capped by Leave → Policies → Rules by leave type → Edit.",
              ],
            ] as const
          ).map(([name, label, hint]) => (
            <div key={name} className="space-y-1 py-2.5 first:pt-1 last:pb-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">{label}</span>
                <Controller
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      disabled={
                        isOptionalHoliday &&
                        (name === "isPaid" ||
                          name === "allowHalfDay" ||
                          name === "carryForwardAllowed")
                      }
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>
              {hint ? <p className="text-muted-foreground pr-12 text-xs">{hint}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}
