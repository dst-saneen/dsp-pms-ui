"use client";

import { useEffect } from "react";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  shiftSchema,
  type ShiftFormValues,
} from "../validation/shift-schema";

import type { Shift } from "../types/shift";

import {
  MasterFormLayout,
  LookupSelect,
  RequiredLabel,
} from "@/components/forms";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { useCompanies } from "@/features/lookups/hooks/use-companies";

interface ShiftFormProps {
  shift?: Shift | null;

  onSubmit: (
    data: ShiftFormValues,
  ) => void;

  onCancel?: () => void;

  isSaving?: boolean;
}

export function ShiftForm({
  shift,
  onSubmit,
}: ShiftFormProps) {
  const form = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),

    defaultValues: {
      companyId: "",
      shiftName: "",
      startTime: "",
      endTime: "",
      breakMinutes: 60,
      graceInMinutes: 15,
      graceOutMinutes: 15,
      isNightShift: false,
      isDefault: false,
      isActive: true,
      remarks: "",
    },
  });

  useEffect(() => {
    if (!shift) {
      form.reset({
        companyId: "",
        shiftName: "",
        startTime: "",
        endTime: "",
        breakMinutes: 60,
        graceInMinutes: 15,
        graceOutMinutes: 15,
        isNightShift: false,
        isDefault: false,
        isActive: true,
        remarks: "",
      });

      return;
    }

    form.reset({
      companyId: shift.companyId,
      shiftName: shift.shiftName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      graceInMinutes: shift.graceInMinutes,
      graceOutMinutes: shift.graceOutMinutes,
      isNightShift: shift.isNightShift,
      isDefault: shift.isDefault,
      isActive: shift.isActive,
      remarks: shift.remarks ?? "",
    });
  }, [shift, form]);

  const {
    data: companies = [],
    isLoading: companiesLoading,
  } = useCompanies();

  return (
    <form
      id="shift-form"
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <MasterFormLayout>

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
            Shift Name
          </RequiredLabel>

          <Input
            {...form.register("shiftName")}
            placeholder="Shift Name"
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel required>
            Start Time
          </RequiredLabel>

          <Input
            type="time"
            {...form.register("startTime")}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel required>
            End Time
          </RequiredLabel>

          <Input
            type="time"
            {...form.register("endTime")}
          />
          <p className="text-muted-foreground text-xs">
            If end is earlier than start, mark Night Shift (overnight). Example:
            22:00–06:00 spans midnight.
          </p>
        </div>

        <div className="space-y-2">
          <RequiredLabel>
            Break Minutes
          </RequiredLabel>

          <Input
            type="number"
            {...form.register("breakMinutes", {
              valueAsNumber: true,
            })}
          />
          <p className="text-muted-foreground text-xs">
            Unpaid break deducted from the span (for example 60 for a 1-hour lunch).
          </p>
        </div>

        <div className="space-y-2">
          <RequiredLabel>
            Grace In (Minutes)
          </RequiredLabel>

          <Input
            type="number"
            {...form.register("graceInMinutes", {
              valueAsNumber: true,
            })}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel>
            Grace Out (Minutes)
          </RequiredLabel>

          <Input
            type="number"
            {...form.register("graceOutMinutes", {
              valueAsNumber: true,
            })}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <RequiredLabel>
              Night Shift
            </RequiredLabel>
            <p className="text-muted-foreground text-xs">
              Turn on when the shift crosses midnight.
            </p>
          </div>

          <Controller
            control={form.control}
            name="isNightShift"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <RequiredLabel>
              Default Shift
            </RequiredLabel>
            <p className="text-muted-foreground text-xs">
              Used when generating a work schedule for this company.
            </p>
          </div>

          <Controller
            control={form.control}
            name="isDefault"
            render={({ field }) => (
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <RequiredLabel>
            Active
          </RequiredLabel>

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
        </div>

        <div className="space-y-2 md:col-span-2">
          <RequiredLabel>
            Remarks
          </RequiredLabel>

          <Textarea
            rows={4}
            placeholder="Remarks"
            {...form.register("remarks")}
          />
        </div>

      </MasterFormLayout>
    </form>
  );
}
