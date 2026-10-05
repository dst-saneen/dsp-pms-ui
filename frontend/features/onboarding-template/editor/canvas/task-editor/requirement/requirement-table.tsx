"use client";

import { DataTable } from "@/components/tables";

import { RequirementEmpty } from "./requirement-empty";

import {
  requirementColumns,
  type RequirementRow,
} from "./requirement-columns";

interface RequirementTableProps {

  rows: RequirementRow[];

  loading?: boolean;

  onEdit?(
    row: RequirementRow,
  ): void;

  onDelete?(
    row: RequirementRow,
  ): void;

}

export function RequirementTable({

  rows,

  loading,

  onEdit,

  onDelete,

}: RequirementTableProps) {

  if (loading) {

    return (

      <div className="text-sm text-muted-foreground">

        Loading requirements...

      </div>

    );

  }

  if (rows.length === 0) {

    return <RequirementEmpty />;

  }

  return (

    <DataTable

      columns={

        requirementColumns({

          onEdit,

          onDelete,

        })

      }

      data={rows}

    />

  );

}