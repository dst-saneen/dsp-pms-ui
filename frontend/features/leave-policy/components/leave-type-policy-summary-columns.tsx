"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";

import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { LeaveTypePolicySummary } from "../lib/leave-policy-leave-type-summary";

function CarryForwardCell({
  row,
  canManage,
  isSaving,
  onSave,
}: {
  row: LeaveTypePolicySummary;
  canManage: boolean;
  isSaving: boolean;
  onSave: (value: number) => void;
}) {
  const initial =
    row.carryForwardValue === undefined || row.carryForwardValue == null
      ? ""
      : String(row.carryForwardValue);

  return (
    <CarryForwardCellEditor
      key={`${row.id}:${initial}`}
      row={row}
      canManage={canManage}
      isSaving={isSaving}
      onSave={onSave}
      initial={initial}
    />
  );
}

function CarryForwardCellEditor({
  row,
  canManage,
  isSaving,
  onSave,
  initial,
}: {
  row: LeaveTypePolicySummary;
  canManage: boolean;
  isSaving: boolean;
  onSave: (value: number) => void;
  initial: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);

  const parsed = value.trim() === "" ? 0 : Number(value);
  const invalid = value.trim() !== "" && (!Number.isFinite(parsed) || parsed < 0);

  if (!canManage) {
    return <span>{row.carryForwardLabel}</span>;
  }

  if (!editing) {
    return (
      <div className="flex min-w-28 items-center gap-2">
        <span>{row.carryForwardLabel}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          disabled={row.policyIds.length === 0}
          onClick={(event) => {
            event.stopPropagation();
            setEditing(true);
          }}
        >
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-44 flex-wrap items-center gap-2">
      <Input
        type="number"
        min={0}
        step="0.5"
        className="h-8 w-20"
        autoFocus
        value={value}
        placeholder={row.carryForwardValue === undefined ? "Mixed" : "0"}
        aria-label={`Carry forward days for ${row.leaveTypeName}`}
        onChange={(event) => setValue(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            setValue(initial);
            setEditing(false);
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        className="h-8"
        disabled={invalid || isSaving || row.policyIds.length === 0}
        onClick={(event) => {
          event.stopPropagation();
          if (invalid) return;
          onSave(value.trim() === "" ? 0 : parsed);
          setEditing(false);
        }}
      >
        {isSaving ? "Saving…" : "Save"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8"
        disabled={isSaving}
        onClick={(event) => {
          event.stopPropagation();
          setValue(initial);
          setEditing(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

export function leaveTypePolicySummaryColumns(options: {
  canManage: boolean;
  savingRowId: string | null;
  onSaveCarryForward: (row: LeaveTypePolicySummary, value: number) => void;
}): ColumnDef<LeaveTypePolicySummary>[] {
  return [
    {
      id: "leaveType",
      accessorFn: (row) => row.leaveTypeName,
      header: "Leave type",
      cell: ({ row }) =>
        `${row.original.leaveTypeName} (${row.original.leaveTypeCode})`,
    },
    {
      id: "branch",
      header: "Branch",
      cell: ({ row }) => row.original.branchName,
    },
    {
      id: "daysPerYear",
      header: "Days / year",
      cell: ({ row }) => row.original.daysPerYearLabel,
    },
    {
      id: "designations",
      header: "Roles covered",
      cell: ({ row }) => String(row.original.designationCount),
    },
    {
      id: "carryForward",
      header: "Carry forward",
      cell: ({ row }) => (
        <CarryForwardCell
          row={row.original}
          canManage={options.canManage}
          isSaving={options.savingRowId === row.original.id}
          onSave={(value) => options.onSaveCarryForward(row.original, value)}
        />
      ),
    },
    {
      id: "negative",
      header: "Balance below zero",
      cell: ({ row }) => {
        const label = row.original.negativeLabel;
        return (
          <span
            title={
              label === "Allowed"
                ? "Employees may request leave even with no days left (overdraw)."
                : label === "Not allowed"
                  ? "Employees cannot request leave when they have no days left."
                  : "Roles for this leave type have different settings."
            }
          >
            <StatusBadge
              label={
                label === "Allowed"
                  ? "Allowed"
                  : label === "Not allowed"
                    ? "Not allowed"
                    : "Mixed"
              }
              tone={
                label === "Allowed"
                  ? "warning"
                  : label === "Mixed"
                    ? "information"
                    : "neutral"
              }
            />
          </span>
        );
      },
    },
  ];
}
