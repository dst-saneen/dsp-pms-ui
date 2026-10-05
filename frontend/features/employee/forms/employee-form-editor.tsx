"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EntityFormPage } from "@/components/common/entity-form-page";
import { FormValidationSummary } from "@/components/forms";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { PersonalInformationSection } from "./sections/personal-information-section";
import { OrganizationSection } from "./sections/organization-section";
import { EmploymentSection } from "./sections/employment-section";
import { useCreateEmployee } from "../hooks/use-create-employee";
import { useUpdateEmployee } from "../hooks/use-update-employee";
import { EMPLOYEE_LIST } from "../lib/employee-navigation";
import {
  employeeSchema,
  type EmployeeFormValues,
} from "../validation/employee-schema";
import type { Employee } from "../types/employee";

interface EmployeeFormEditorProps {
  mode: "create" | "edit";
  employee?: Employee | null;
  returnTo: string;
  canManage: boolean;
}

export function EmployeeFormEditor({
  mode,
  employee = null,
  returnTo,
  canManage,
}: EmployeeFormEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      companyId: "",
      branchId: "",
      departmentId: "",
      designationId: "",
      managerId: "",
      employeeType: "Permanent",
      joiningDate: "",
    },
  });

  useEffect(() => {
    if (!employee) {
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
        companyId: "",
        branchId: "",
        departmentId: "",
        designationId: "",
        managerId: "",
        employeeType: "Permanent",
        joiningDate: "",
      });
      return;
    }
    form.reset({
      firstName: employee.firstName ?? "",
      lastName: employee.lastName ?? "",
      email: employee.email ?? "",
      mobile: employee.mobile ?? "",
      companyId: employee.companyId ?? "",
      branchId: employee.branchId ?? "",
      departmentId: employee.departmentId ?? "",
      designationId: employee.designationId ?? "",
      managerId: employee.managerId ?? "",
      employeeType: employee.employeeType?.trim() || "Permanent",
      joiningDate: employee.joiningDate
        ? employee.joiningDate.slice(0, 10)
        : "",
    });
  }, [employee, form]);

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();

  const isDirty = form.formState.isDirty;
  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([
    {
      label:
        mode === "create"
          ? "New Employee"
          : employee
            ? `${employee.firstName} ${employee.lastName ?? ""}`.trim()
            : "Edit Employee",
      href: null,
    },
  ]);

  const firstName = useWatch({ control: form.control, name: "firstName" });
  const lastName = useWatch({ control: form.control, name: "lastName" });
  const companyId = useWatch({ control: form.control, name: "companyId" });
  const branchId = useWatch({ control: form.control, name: "branchId" });
  const departmentId = useWatch({
    control: form.control,
    name: "departmentId",
  });
  const designationId = useWatch({
    control: form.control,
    name: "designationId",
  });
  const saveSummary = useMemo(() => {
    const company =
      companies.find((item) => item.id === companyId)?.name ??
      (companyId ? "Selected company" : "No company");
    return [
      `Name: ${[firstName, lastName].filter(Boolean).join(" ") || "—"}`,
      `Company: ${company}`,
      branchId ? "Branch: selected" : "Branch: missing",
      departmentId ? "Department: selected" : "Department: missing",
      designationId
        ? "Designation: selected"
        : "Designation: optional / not set",
    ];
  }, [
    branchId,
    companies,
    companyId,
    departmentId,
    designationId,
    firstName,
    lastName,
  ]);

  const isSaving = createEmployee.isPending || updateEmployee.isPending;

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(returnTo);
  }, [confirmLeave, returnTo, router]);

  const onInvalid = (errors: typeof form.formState.errors) => {
    const messages = Object.values(errors)
      .map((error) => error?.message)
      .filter((message): message is string => Boolean(message));
    setValidationErrors(
      messages.length
        ? messages
        : ["Fix the highlighted fields before saving."],
    );
  };

  const onSubmit = (data: EmployeeFormValues) => {
    if (!canManage) return;
    setValidationErrors([]);

    if (mode === "edit" && employee) {
      updateEmployee.mutate(
        { id: employee.id, data },
        {
          onSuccess: async () => {
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: ["employee", employee.id],
              }),
              queryClient.invalidateQueries({ queryKey: ["employees"] }),
              queryClient.invalidateQueries({
                queryKey: ["employee-summary"],
              }),
            ]);
            toast.success("Employee updated.");
            router.push(returnTo);
          },
          onError: (error) => {
            toast.error(
              getApiErrorMessage(error, "Unable to update employee."),
            );
          },
        },
      );
      return;
    }

    createEmployee.mutate(data, {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["employees"] }),
          queryClient.invalidateQueries({ queryKey: ["employee-summary"] }),
        ]);
        toast.success("Employee created.");
        router.push(returnTo === EMPLOYEE_LIST ? EMPLOYEE_LIST : returnTo);
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, "Unable to create employee."));
      },
    });
  };

  return (
    <EntityFormPage
      title={
        mode === "create"
          ? "Add Employee"
          : `Edit ${employee?.firstName ?? "Employee"} ${employee?.lastName ?? ""}`.trim()
      }
      description={
        mode === "create"
          ? "Create a record for someone already hired. Review the save summary before submit."
          : "Update employee and organization information. Failed saves keep your entered data."
      }
      formId="employee-form"
      primaryLabel={mode === "edit" ? "Update Employee" : "Save Employee"}
      onSecondary={goBack}
      isSaving={isSaving}
    >
      <form
        id="employee-form"
        className="space-y-6"
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
      >
        <FormValidationSummary errors={validationErrors} />

        <section
          className="border-border bg-muted/20 space-y-2 rounded-xl border p-4"
          aria-label="Save summary"
        >
          <h2 className="text-sm font-semibold">Save summary</h2>
          <ul className="text-muted-foreground list-inside list-disc text-xs">
            {saveSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <PersonalInformationSection form={form} />
        <OrganizationSection
          form={form}
          companies={companies}
          companiesLoading={companiesLoading}
        />
        <EmploymentSection form={form} employee={employee} />
      </form>
    </EntityFormPage>
  );
}
