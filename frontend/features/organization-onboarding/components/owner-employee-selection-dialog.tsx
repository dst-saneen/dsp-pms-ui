"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BranchService } from "@/features/branch/services/branch-service";
import { CompanyService } from "@/features/company/services/company-service";
import { DepartmentService } from "@/features/department/services/department-service";
import { DesignationService } from "@/features/designation/services/designation-service";

import type { OwnerEmployeeSelectionInput } from "../types";

interface OwnerEmployeeSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  isPending: boolean;
  onSubmit: (selection: OwnerEmployeeSelectionInput) => Promise<void>;
}

export function OwnerEmployeeSelectionDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  isPending,
  onSubmit,
}: OwnerEmployeeSelectionDialogProps) {
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  function clearSelection() {
    setCompanyId("");
    setBranchId("");
    setDepartmentId("");
    setDesignationId("");
    setValidationMessage("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) clearSelection();
    onOpenChange(nextOpen);
  }

  const companiesQuery = useQuery({
    queryKey: ["owner-employee-selection", "companies"],
    queryFn: () => CompanyService.getAll(),
    enabled: open,
  });
  const branchesQuery = useQuery({
    queryKey: ["owner-employee-selection", "branches", companyId],
    queryFn: () => BranchService.getBranches(companyId),
    enabled: open && Boolean(companyId),
  });
  const departmentsQuery = useQuery({
    queryKey: ["owner-employee-selection", "departments", companyId, branchId],
    queryFn: () => DepartmentService.getDepartments(branchId, companyId),
    enabled: open && Boolean(companyId && branchId),
  });
  const designationsQuery = useQuery({
    queryKey: ["owner-employee-selection", "designations", companyId],
    queryFn: () => DesignationService.getDesignations(companyId),
    enabled: open && Boolean(companyId),
  });

  const companies = (companiesQuery.data ?? []).filter((company) => company.isActive);
  const branches = (branchesQuery.data ?? []).filter(
    (branch) => branch.isActive && branch.companyId === companyId
  );
  const departments = (departmentsQuery.data ?? []).filter(
    (department) =>
      department.isActive && department.companyId === companyId && department.branchId === branchId
  );
  const designations = useMemo(
    () =>
      (designationsQuery.data ?? []).filter(
        (designation) =>
          designation.isActive &&
          designation.companyId === companyId &&
          (!designation.departmentId || designation.departmentId === departmentId)
      ),
    [companyId, departmentId, designationsQuery.data]
  );

  const hasQueryError =
    companiesQuery.isError ||
    branchesQuery.isError ||
    departmentsQuery.isError ||
    designationsQuery.isError;
  const canSubmit = Boolean(companyId && branchId && departmentId && designationId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      setValidationMessage(
        "Select a Company, Branch, Department, and Designation before continuing."
      );
      return;
    }
    setValidationMessage("");
    try {
      await onSubmit({ companyId, branchId, departmentId, designationId });
    } catch {
      // The calling mutation owns user-facing API feedback. Keep the choices
      // intact so the owner can correct or retry them.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <AssignmentSelect
            id="owner-company"
            label="Company"
            placeholder={companiesQuery.isLoading ? "Loading companies…" : "Select company"}
            value={companyId}
            disabled={companiesQuery.isLoading || companies.length === 0}
            options={companies.map((company) => ({
              id: company.id,
              label: company.companyName,
            }))}
            onValueChange={(value) => {
              setCompanyId(value);
              setBranchId("");
              setDepartmentId("");
              setDesignationId("");
              setValidationMessage("");
            }}
          />
          <AssignmentSelect
            id="owner-branch"
            label="Branch"
            placeholder={branchesQuery.isLoading ? "Loading branches…" : "Select branch"}
            value={branchId}
            disabled={!companyId || branchesQuery.isLoading || branches.length === 0}
            options={branches.map((branch) => ({
              id: branch.id,
              label: branch.branchName,
            }))}
            onValueChange={(value) => {
              setBranchId(value);
              setDepartmentId("");
              setDesignationId("");
              setValidationMessage("");
            }}
          />
          <AssignmentSelect
            id="owner-department"
            label="Department"
            placeholder={departmentsQuery.isLoading ? "Loading departments…" : "Select department"}
            value={departmentId}
            disabled={!branchId || departmentsQuery.isLoading || departments.length === 0}
            options={departments.map((department) => ({
              id: department.id,
              label: department.departmentName,
            }))}
            onValueChange={(value) => {
              setDepartmentId(value);
              setDesignationId("");
              setValidationMessage("");
            }}
          />
          <AssignmentSelect
            id="owner-designation"
            label="Designation"
            placeholder={
              designationsQuery.isLoading ? "Loading designations…" : "Select designation"
            }
            value={designationId}
            disabled={!departmentId || designationsQuery.isLoading || designations.length === 0}
            options={designations.map((designation) => ({
              id: designation.id,
              label: designation.designationName,
            }))}
            onValueChange={(value) => {
              setDesignationId(value);
              setValidationMessage("");
            }}
          />

          {hasQueryError ? (
            <p className="text-destructive text-sm" role="alert">
              Assignment choices could not be loaded. Close this dialog and retry.
            </p>
          ) : null}
          {!designationsQuery.isLoading && departmentId && designations.length === 0 ? (
            <p className="text-destructive text-sm" role="alert">
              No active designation is available for this department. Create one in organization
              setup, then retry.
            </p>
          ) : null}
          {validationMessage ? (
            <p className="text-destructive text-sm" role="alert">
              {validationMessage}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isPending || hasQueryError}>
              {isPending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentSelect({
  id,
  label,
  placeholder,
  value,
  disabled,
  options,
  onValueChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  disabled: boolean;
  options: Array<{ id: string; label: string }>;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full" disabled={disabled}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
