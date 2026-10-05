"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormValidationSummary,
  LookupSelect,
  MasterFormLayout,
  RequiredLabel,
} from "@/components/forms";
import { getApiErrorMessage } from "@/services/api-client";
import { useEmployees } from "@/features/employee/hooks/use-employees";
import { invalidateOnboardingRuntime } from "@/features/onboarding/hooks/invalidate-onboarding-runtime";
import { onboardingKeys } from "@/features/onboarding/hooks/query-keys";
import { OnboardingApiService } from "@/features/onboarding/services/onboarding-api.service";

import { remediationForStartBlocker } from "../lib/start-onboarding-navigation";

const startOnboardingSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  startDate: z.string().min(1, "Start date is required"),
  remarks: z.string().optional(),
});

export type StartOnboardingFormValues = z.infer<typeof startOnboardingSchema>;

interface StartEmployeeOnboardingFormProps {
  defaultEmployeeId?: string;
  formId?: string;
  /** When true, sticky EntityFormPage footer owns Cancel/Start. */
  hideActions?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  onCanSubmitChange?: (canSubmit: boolean) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onPendingChange?: (isPending: boolean) => void;
}

function createOperationId() {
  return crypto.randomUUID();
}

export function StartEmployeeOnboardingForm({
  defaultEmployeeId,
  formId = "start-employee-onboarding-form",
  hideActions = false,
  onSuccess,
  onCancel,
  onCanSubmitChange,
  onDirtyChange,
  onPendingChange,
}: StartEmployeeOnboardingFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const operationIdRef = useRef<string>(createOperationId());

  const {
    data: employees = [],
    isLoading: employeesLoading,
  } = useEmployees();

  const form = useForm<StartOnboardingFormValues>({
    resolver: zodResolver(startOnboardingSchema),
    defaultValues: {
      employeeId: defaultEmployeeId ?? "",
      startDate: new Date().toISOString().slice(0, 10),
      remarks: "",
    },
  });

  const selectedEmployeeId = useWatch({
    control: form.control,
    name: "employeeId",
  });
  const selectedStartDate = useWatch({
    control: form.control,
    name: "startDate",
  });

  useEffect(() => {
    if (defaultEmployeeId) {
      form.setValue("employeeId", defaultEmployeeId, {
        shouldValidate: true,
      });
    }
  }, [defaultEmployeeId, form]);

  useEffect(() => {
    operationIdRef.current = createOperationId();
  }, [selectedEmployeeId, selectedStartDate]);

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  const preflightQuery = useQuery({
    queryKey: onboardingKeys.preflight({
      employeeId: selectedEmployeeId,
      startDate: selectedStartDate,
    }),
    queryFn: () =>
      OnboardingApiService.getPreflight({
        employeeId: selectedEmployeeId,
        startDate: selectedStartDate,
      }),
    enabled: Boolean(selectedEmployeeId && selectedStartDate),
  });

  const startMutation = useMutation({
    mutationFn: (values: StartOnboardingFormValues) =>
      OnboardingApiService.start({
        operationId: operationIdRef.current,
        employeeId: values.employeeId,
        startDate: values.startDate,
        remarks: values.remarks?.trim() || undefined,
      }),
    onSuccess: async (onboarding) => {
      await invalidateOnboardingRuntime(queryClient);
      toast.success("Employee onboarding started.");
      onSuccess?.();
      router.push(`/hr/employee-onboarding/${onboarding.id}`);
    },
  });

  useEffect(() => {
    onPendingChange?.(startMutation.isPending);
  }, [onPendingChange, startMutation.isPending]);

  const canSubmit = useMemo(() => {
    const preflight = preflightQuery.data;
    if (!preflight) {
      return false;
    }

    return (
      preflight.canStart === true &&
      preflight.allowedActions.includes("START")
    );
  }, [preflightQuery.data]);

  useEffect(() => {
    onCanSubmitChange?.(canSubmit);
  }, [canSubmit, onCanSubmitChange]);

  const validationErrors = useMemo(() => {
    return Object.values(form.formState.errors)
      .map((error) => error?.message)
      .filter((message): message is string => Boolean(message));
  }, [form.formState.errors]);

  const onSubmit = async (values: StartOnboardingFormValues) => {
    if (!canSubmit) {
      toast.error("Fix start blockers before starting onboarding.");
      return;
    }
    try {
      await startMutation.mutateAsync(values);
    } catch (error) {
      toast.error(
        getApiErrorMessage(
          error,
          "Could not start employee onboarding.",
        ),
      );
    }
  };

  const designationId = preflightQuery.data?.employee.designationId ?? null;

  return (
    <form
      id={formId}
      className="space-y-6"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FormValidationSummary errors={validationErrors} />

      <MasterFormLayout>
        <div className="space-y-2">
          <RequiredLabel required>Employee</RequiredLabel>

          <LookupSelect
            value={selectedEmployeeId}
            onChange={(value) =>
              form.setValue("employeeId", value, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            items={employees.map((employee) => ({
              id: employee.id,
              code: employee.employeeCode,
              name: `${employee.firstName} ${employee.lastName ?? ""}`.trim(),
            }))}
            placeholder="Select employee"
            loading={employeesLoading}
            disabled={employeesLoading || !!defaultEmployeeId}
          />
          <p className="text-muted-foreground text-xs">
            Template is resolved from the employee&apos;s designation. You do
            not paste a template ID.
          </p>
        </div>

        <div className="space-y-2">
          <RequiredLabel required>Start Date</RequiredLabel>

          <Input type="date" {...form.register("startDate")} />
        </div>
      </MasterFormLayout>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="text-sm font-medium">Start preflight</div>

        {!selectedEmployeeId || !selectedStartDate ? (
          <p className="text-muted-foreground text-sm">
            Select an employee and start date to preview template resolution.
          </p>
        ) : null}

        {preflightQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading preflight...</p>
        ) : null}

        {preflightQuery.error ? (
          <p className="text-destructive text-sm">
            {getApiErrorMessage(
              preflightQuery.error,
              "Could not load start preflight.",
            )}
          </p>
        ) : null}

        {preflightQuery.data ? (
          <div className="space-y-3 text-sm">
            {preflightQuery.data.resolvedTemplate ? (
              <div>
                <div className="font-medium">Resolved template</div>
                <p className="text-muted-foreground">
                  {preflightQuery.data.resolvedTemplate.templateName} (
                  {preflightQuery.data.resolvedTemplate.templateCode}) · v
                  {preflightQuery.data.resolvedTemplate.versionNo} ·{" "}
                  {preflightQuery.data.resolvedTemplate.resolutionSource}
                </p>
                {designationId ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    From employee designation ·{" "}
                    <Link
                      href={`/administration/designations/${designationId}/edit?source=onboarding-templates&return=${encodeURIComponent("/hr/onboarding-templates")}`}
                      className="text-foreground underline underline-offset-2"
                    >
                      Review designation link
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-destructive">
                No published template could be resolved for this employee.
              </p>
            )}

            <div className="grid gap-2 md:grid-cols-3">
              <div>
                <span className="font-medium">Tasks:</span>{" "}
                {preflightQuery.data.summary.totalTasks}
              </div>
              <div>
                <span className="font-medium">Mandatory:</span>{" "}
                {preflightQuery.data.summary.mandatoryTasks}
              </div>
              <div>
                <span className="font-medium">Asset tasks:</span>{" "}
                {preflightQuery.data.summary.assetTasks}
              </div>
            </div>

            {preflightQuery.data.blockers.length > 0 ? (
              <div className="space-y-2">
                <div className="font-medium text-destructive">Blockers</div>
                {preflightQuery.data.blockers.map((blocker) => {
                  const remediation = remediationForStartBlocker({
                    code: blocker.code,
                    entityId: blocker.entityId,
                    designationId,
                  });
                  return (
                    <div
                      key={`${blocker.code}-${blocker.entityId ?? "global"}`}
                      className="space-y-2 rounded-md border border-destructive/20 bg-destructive/5 p-2"
                    >
                      <p>{blocker.message}</p>
                      {remediation ? (
                        <Link
                          href={remediation.href}
                          className="inline-flex text-sm font-medium underline underline-offset-2"
                        >
                          {remediation.label}
                        </Link>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {preflightQuery.data.warnings.length > 0 ? (
              <div className="space-y-2">
                <div className="font-medium">Warnings</div>
                {preflightQuery.data.warnings.map((warning) => (
                  <p
                    key={`${warning.code}-${warning.entityId ?? "global"}`}
                    className="rounded-md border bg-muted/40 p-2"
                  >
                    {warning.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <RequiredLabel>Remarks</RequiredLabel>

        <Textarea
          rows={3}
          placeholder="Optional onboarding notes"
          {...form.register("remarks")}
        />
      </div>

      {!hideActions ? (
        <div className="flex justify-end gap-3 border-t pt-6">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>

          <Button
            type="submit"
            disabled={!canSubmit || startMutation.isPending}
          >
            {startMutation.isPending ? "Starting..." : "Start Onboarding"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
