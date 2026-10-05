"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  LookupSelect,
  MasterFormLayout,
  RequiredLabel,
} from "@/components/forms";
import { getAssetMutationMessage, isAssetVersionConflict } from "@/features/asset/lib/asset-errors";
import {
  useEligibleEmployees,
  useEligibleForAssignment,
} from "@/features/asset/hooks/use-eligible-employees";
import { createOperationId } from "@/features/asset/lib/operation-id";
import { useEmployees } from "@/features/employee/hooks/use-employees";

import { useCreateEmployeeAsset } from "../hooks/use-create-employee-asset";
import { EmployeeAssetService } from "../services";

const assignAssetSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  assetId: z.string().min(1, "Physical item is required"),
  assignedDate: z.string().min(1, "Assigned date is required"),
  remarks: z.string().optional(),
});

type AssignAssetFormValues = z.infer<typeof assignAssetSchema>;

interface AssignEmployeeAssetFormProps {
  employeeId?: string;
  assetId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AssignEmployeeAssetForm({
  employeeId,
  assetId,
  onSuccess,
  onCancel,
}: AssignEmployeeAssetFormProps) {
  const createAssignment = useCreateEmployeeAsset();
  const [saving, setSaving] = useState(false);
  const assetPreset = Boolean(assetId);

  const form = useForm<AssignAssetFormValues>({
    resolver: zodResolver(assignAssetSchema),
    defaultValues: {
      employeeId: employeeId ?? "",
      assetId: assetId ?? "",
      assignedDate: new Date().toISOString().slice(0, 10),
      remarks: "",
    },
  });
  const selectedEmployeeId = useWatch({
    control: form.control,
    name: "employeeId",
  });
  const selectedAssetId = useWatch({
    control: form.control,
    name: "assetId",
  });

  // Asset row ⋯ Assign: load people eligible for that item.
  const eligibleEmployees = useEligibleEmployees(
    assetPreset ? assetId : undefined,
  );
  // Free assign: always use active directory; ignored when asset was pre-selected.
  const directoryEmployees = useEmployees({ isActive: true });
  // After person is known: load available physical items for them.
  const eligibleAssets = useEligibleForAssignment(
    selectedEmployeeId || employeeId,
  );

  const employeeItems = useMemo(() => {
    if (assetPreset) {
      return (eligibleEmployees.data?.items ?? []).map((employee) => ({
        id: employee.id,
        code: employee.code,
        name: employee.name,
      }));
    }
    return (directoryEmployees.data ?? [])
      .filter((employee) => employee.isActive)
      .map((employee) => ({
        id: employee.id,
        code: employee.employeeCode,
        name: [employee.firstName, employee.lastName].filter(Boolean).join(" "),
      }));
  }, [assetPreset, directoryEmployees.data, eligibleEmployees.data?.items]);

  const assignableAssets = useMemo(
    () => eligibleAssets.data?.items ?? [],
    [eligibleAssets.data?.items],
  );
  const selectedAsset = assignableAssets.find(
    (item) => item.id === selectedAssetId,
  );
  const presetAssetLabel = assetId
    ? assignableAssets.find((item) => item.id === assetId)?.assetName
    : undefined;

  useEffect(() => {
    if (employeeId) {
      form.setValue("employeeId", employeeId, { shouldValidate: true });
    }
  }, [employeeId, form]);

  useEffect(() => {
    if (assetId) {
      form.setValue("assetId", assetId, { shouldValidate: true });
    }
  }, [assetId, form]);

  // Changing employee invalidates a previously picked item.
  useEffect(() => {
    if (assetPreset) {
      return;
    }
    if (!selectedEmployeeId) {
      form.setValue("assetId", "", { shouldValidate: false });
      return;
    }
    if (
      selectedAssetId &&
      assignableAssets.length > 0 &&
      !assignableAssets.some((item) => item.id === selectedAssetId)
    ) {
      form.setValue("assetId", "", { shouldValidate: true });
    }
  }, [
    assetPreset,
    assignableAssets,
    form,
    selectedAssetId,
    selectedEmployeeId,
  ]);

  const onSubmit = async (values: AssignAssetFormValues) => {
    try {
      setSaving(true);
      if (selectedAsset?.kind === "SOFTWARE_LICENSE") {
        await EmployeeAssetService.allocateLicense(values.assetId, {
          operationId: createOperationId(),
          employeeId: values.employeeId,
          allocatedDate: values.assignedDate,
          expectedPoolVersion: selectedAsset.version,
          remarks: values.remarks?.trim() || undefined,
        });
      } else {
        await createAssignment.mutateAsync({
          operationId: createOperationId(),
          employeeId: values.employeeId,
          assetId: values.assetId,
          assignedDate: values.assignedDate,
          expectedAssetVersion: selectedAsset?.version,
          remarks: values.remarks?.trim() || undefined,
        });
      }

      toast.success("Asset assigned.");
      onSuccess?.();
    } catch (error) {
      if (isAssetVersionConflict(error)) {
        void eligibleAssets.refetch();
      }
      toast.error(getAssetMutationMessage(error, "Could not assign asset."));
    } finally {
      setSaving(false);
    }
  };

  const employeesLoading = assetPreset
    ? eligibleEmployees.isLoading
    : directoryEmployees.isLoading;
  const canPickEmployee = !employeeId;
  const canPickAsset =
    !assetPreset && Boolean(selectedEmployeeId || employeeId);

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
      <p className="text-muted-foreground text-sm">
        {assetPreset
          ? "This physical item is already selected. Pick an eligible employee, then Assign."
          : "Pick the employee first, then choose an available physical item for them."}
      </p>
      <MasterFormLayout>
        {canPickEmployee ? (
          <div className="space-y-2">
            <RequiredLabel required>Employee</RequiredLabel>
            <LookupSelect
              value={selectedEmployeeId}
              onChange={(value) =>
                form.setValue("employeeId", value, { shouldValidate: true })
              }
              items={employeeItems}
              placeholder={
                employeesLoading
                  ? "Loading employees…"
                  : employeeItems.length === 0
                    ? "No eligible employees"
                    : "Select employee"
              }
              loading={employeesLoading}
              disabled={employeesLoading}
            />
            {!employeesLoading && employeeItems.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                {assetPreset
                  ? "No eligible employees for this item (check branch / employment status)."
                  : "No active employees found. Check HR Employees directory."}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <RequiredLabel required>Physical item</RequiredLabel>
          {assetPreset ? (
            <Input
              value={
                presetAssetLabel
                  ? `${presetAssetLabel}`
                  : "Selected from Assets list"
              }
              disabled
              readOnly
            />
          ) : (
            <LookupSelect
              value={selectedAssetId}
              onChange={(value) =>
                form.setValue("assetId", value, { shouldValidate: true })
              }
              items={assignableAssets.map((item) => ({
                id: item.id,
                code: item.assetCode,
                name: item.assetName,
              }))}
              placeholder={
                !canPickAsset
                  ? "Select an employee first"
                  : eligibleAssets.isLoading
                    ? "Loading available items…"
                    : assignableAssets.length === 0
                      ? "No available items for this employee"
                      : "Select eligible item"
              }
              loading={eligibleAssets.isLoading}
              disabled={!canPickAsset || eligibleAssets.isLoading}
            />
          )}
          {canPickAsset &&
          !eligibleAssets.isLoading &&
          assignableAssets.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No AVAILABLE physical items for this employee. Create the asset
              under Assets first, and confirm it is not already assigned.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <RequiredLabel required>Assigned Date</RequiredLabel>
          <Input type="date" {...form.register("assignedDate")} />
        </div>
      </MasterFormLayout>

      <div className="space-y-2">
        <RequiredLabel>Remarks</RequiredLabel>
        <Textarea
          rows={3}
          placeholder="Optional assignment notes"
          {...form.register("remarks")}
        />
      </div>

      <div className="flex justify-end gap-3 border-t pt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Assigning..." : "Assign item"}
        </Button>
      </div>
    </form>
  );
}
