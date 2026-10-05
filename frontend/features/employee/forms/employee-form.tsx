"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";

import { useCompanies } from "@/features/lookups/hooks/use-companies";

import { useCreateEmployee } from "../hooks/use-create-employee";
import { useUpdateEmployee } from "../hooks/use-update-employee";

import { PersonalInformationSection } from "./sections/personal-information-section";
import { OrganizationSection } from "./sections/organization-section";
import { EmploymentSection } from "./sections/employment-section";

import { employeeSchema } from "../validation/employee-schema";
import type { EmployeeFormValues } from "../validation/employee-schema";
import type { Employee } from "../types/employee";

interface EmployeeFormProps {
  employee?: Employee | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EmployeeForm({ employee, onSuccess, onCancel }: EmployeeFormProps) {
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

  const isEdit = !!employee;

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
      joiningDate: employee.joiningDate ? employee.joiningDate.slice(0, 10) : "",
    });
  }, [employee, form]);

  const { data: companies = [], isLoading: companiesLoading } = useCompanies();

  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const queryClient = useQueryClient();

  const onSubmit = (data: EmployeeFormValues) => {
    if (isEdit && employee) {
      updateEmployee.mutate(
        {
          id: employee.id,
          data,
        },
        {
          onSuccess: async () => {
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: ["employee", employee.id],
              }),
              queryClient.invalidateQueries({
                queryKey: ["employees"],
              }),
              queryClient.invalidateQueries({
                queryKey: ["employee-summary"],
              }),
            ]);

            form.reset();
            onSuccess?.();
          },
        }
      );
    } else {
      createEmployee.mutate(data, {
        onSuccess: async () => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ["employees"],
            }),
            queryClient.invalidateQueries({
              queryKey: ["employee-summary"],
            }),
          ]);

          form.reset();
          onSuccess?.();
        },
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <PersonalInformationSection form={form} />

      <OrganizationSection form={form} companies={companies} companiesLoading={companiesLoading} />

      <EmploymentSection form={form} employee={employee} />

      <div className="border-border bg-card flex flex-col-reverse gap-2 rounded-xl border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_18px_rgba(16,24,40,0.03)] sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            form.reset();
            onCancel?.();
          }}
        >
          Cancel
        </Button>

        <Button type="submit" disabled={createEmployee.isPending || updateEmployee.isPending}>
          {createEmployee.isPending || updateEmployee.isPending
            ? "Saving..."
            : isEdit
              ? "Update Employee"
              : "Save Employee"}
        </Button>
      </div>
    </form>
  );
}
