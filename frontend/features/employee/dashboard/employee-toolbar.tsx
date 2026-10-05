"use client";

import { UserPlus, UserRoundSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageToolbar } from "@/components/common/page-toolbar";

interface EmployeeToolbarProps {
  onRecruit: () => void;
  onAddEmployee?: () => void;
  showAddEmployee?: boolean;
  onInternalEntry?: () => void;
  showInternalEntry?: boolean;
  onRefresh: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  totalLabel?: string;
}

export function EmployeeToolbar({
  onRecruit,
  onAddEmployee,
  showAddEmployee = false,
  onInternalEntry,
  showInternalEntry = false,
  onRefresh,
  search,
  onSearchChange,
  totalLabel,
}: EmployeeToolbarProps) {
  return (
    <PageToolbar>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <Input
          aria-label="Search employees"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search employees..."
          className="max-w-sm"
        />
        {totalLabel ? (
          <p className="text-muted-foreground text-xs">{totalLabel}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onRefresh}>
          Refresh
        </Button>

        {showInternalEntry && onInternalEntry ? (
          <Button variant="outline" onClick={onInternalEntry}>
            Internal entry
          </Button>
        ) : null}

        {showAddEmployee && onAddEmployee ? (
          <Button variant="outline" onClick={onAddEmployee}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Employee
          </Button>
        ) : null}

        <Button onClick={onRecruit}>
          <UserRoundSearch className="mr-2 h-4 w-4" />
          Recruit Candidate
        </Button>
      </div>
    </PageToolbar>
  );
}
