"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/common/status-badge";
import type {
  DesignationOnboardingWorkspace,
} from "@/features/designation/types";

import { DepartmentListCell } from "./department-list-cell";
import { DesignationInactiveRecovery } from "./designation-inactive-recovery";

export const onboardingTemplateColumns =
(): ColumnDef<DesignationOnboardingWorkspace>[] => [

  {
    accessorKey: "designationCode",

    header: "Designation Code",
  },

  {
    accessorKey: "designationName",

    header: "Designation",
    cell: ({ row }) => (
      <div className="space-y-1">
        <p className="font-medium">{row.original.designationName}</p>
        {!row.original.isActive ? (
          <DesignationInactiveRecovery designationId={row.original.id} />
        ) : null}
      </div>
    ),
  },

  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <StatusBadge
        label={row.original.isActive ? "Active" : "Inactive"}
        tone={row.original.isActive ? "success" : "warning"}
      />
    ),
  },

  {
    id: "departments",

    header: "Departments",

    cell: ({ row }) => {

      const version =
        row.original.onboardingTemplate?.versions?.[0];

      return (

        <DepartmentListCell
          templateId={row.original.onboardingTemplate?.id ?? ""}
          designationId={row.original.id}
          departments={version?.departments ?? []}
          readOnly={!row.original.isActive}
        />

      );

    },

  },

  {
    id: "tasks",

    header: "Total Tasks",

    cell: ({ row }) => {

      const version =
        row.original.onboardingTemplate?.versions?.[0];

      const departments =
        version?.departments ?? [];

      return departments.reduce(

        (departmentTotal, department) =>

          departmentTotal +

          (department.taskGroups ?? []).reduce(

            (groupTotal, group) =>

              groupTotal +

              (group.tasks?.length ?? 0),

            0,

          ),

        0,

      );

    },

  }

];
