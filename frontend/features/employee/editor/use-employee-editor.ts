"use client";

import { useRouter } from "next/navigation";

import { useEmployee, useDeactivateEmployee } from "../hooks";
import { employeeEditHref } from "../lib/employee-navigation";

export function useEmployeeEditor(
  employeeId: string,
  listReturnTo = "/hr/employees",
) {
  const router = useRouter();

  const { data: employee, isLoading, error, refetch } =
    useEmployee(employeeId);

  const deactivateMutation = useDeactivateEmployee();

  function edit() {
    router.push(
      employeeEditHref(employeeId, `/hr/employees/${employeeId}`),
    );
  }

  function backToList() {
    router.push(listReturnTo);
  }

  async function deactivate() {
    await deactivateMutation.mutateAsync(employeeId);
    await refetch();
  }

  return {
    employee,
    isLoading,
    error,
    isDeactivating: deactivateMutation.isPending,
    edit,
    backToList,
    deactivate,
    refresh: refetch,
  };
}
