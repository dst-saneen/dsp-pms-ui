"use client";

import { DataTable } from "@/components/tables";

import {
  executionProfileColumns,
  type ExecutionProfileRow,
} from "./execution-profile-columns";

import { ExecutionProfileEmpty } from "./execution-profile-empty";

interface ExecutionProfileTableProps {

  rows: ExecutionProfileRow[];

  loading?: boolean;

  onEdit?(
    row: ExecutionProfileRow,
  ): void;

  onDelete?(
    row: ExecutionProfileRow,
  ): void;

}

export function ExecutionProfileTable({

  rows,

  loading,

  onEdit,

  onDelete,

}: ExecutionProfileTableProps) {

  if (loading) {

    return (

      <div className="text-sm text-muted-foreground">

        Loading execution profiles...

      </div>

    );

  }

  if (rows.length === 0) {

    return <ExecutionProfileEmpty />;

  }

  return (

    <DataTable

      columns={

        executionProfileColumns({

          onEdit,

          onDelete,

        })

      }

      data={rows}

    />

  );

}