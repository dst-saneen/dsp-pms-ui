"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { groupPermissionsByNamespace } from "../lib/assignment-summary";
import type { SecurityPermission } from "../types";

interface PermissionPickerProps {
  permissions: SecurityPermission[];
  selectedIds: string[];
  onChange: (permissionIds: string[]) => void;
  disabled?: boolean;
}

export function PermissionPicker({
  permissions,
  selectedIds,
  onChange,
  disabled = false,
}: PermissionPickerProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return permissions;
    return permissions.filter(
      (permission) =>
        permission.name.toLowerCase().includes(keyword) ||
        permission.code.toLowerCase().includes(keyword) ||
        (permission.description ?? "").toLowerCase().includes(keyword),
    );
  }, [permissions, search]);

  const groups = useMemo(
    () => groupPermissionsByNamespace(filtered),
    [filtered],
  );

  function toggle(permissionId: string, checked: boolean) {
    if (disabled) return;
    onChange(
      checked
        ? [...selectedIds, permissionId]
        : selectedIds.filter((id) => id !== permissionId),
    );
  }

  function toggleGroup(groupIds: string[], checked: boolean) {
    if (disabled) return;
    if (checked) {
      const merged = new Set([...selectedIds, ...groupIds]);
      onChange([...merged]);
      return;
    }
    const remove = new Set(groupIds);
    onChange(selectedIds.filter((id) => !remove.has(id)));
  }

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-foreground text-sm font-medium">Permissions</legend>
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search permissions by name or code"
          className="pl-9"
          aria-label="Search permissions"
        />
      </div>
      <p className="text-muted-foreground text-xs">
        {selectedIds.length} selected
        {search.trim() ? ` · showing ${filtered.length} matches` : null}
      </p>
      <div className="space-y-4">
        {groups.map(([namespace, items]) => {
          const groupIds = items.map((item) => item.id);
          const selectedInGroup = groupIds.filter((id) =>
            selectedIds.includes(id),
          ).length;
          const allSelected =
            groupIds.length > 0 && selectedInGroup === groupIds.length;

          return (
            <section key={namespace} aria-labelledby={`permission-group-${namespace}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3
                  id={`permission-group-${namespace}`}
                  className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                >
                  {namespace}
                </h3>
                <button
                  type="button"
                  aria-label={`${allSelected ? "Clear" : "Select"} ${namespace} permissions`}
                  className="text-primary text-xs font-medium hover:underline disabled:opacity-50"
                  disabled={disabled || groupIds.length === 0}
                  onClick={() => toggleGroup(groupIds, !allSelected)}
                >
                  {allSelected ? "Clear group" : "Select group"}
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {items.map((permission) => {
                  const checked = selectedIds.includes(permission.id);
                  return (
                    <label
                      key={permission.id}
                      className="border-border hover:bg-muted/40 flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary mt-0.5 size-4"
                        checked={checked}
                        disabled={disabled}
                        onChange={(event) =>
                          toggle(permission.id, event.target.checked)
                        }
                      />
                      <span className="min-w-0">
                        <span className="text-foreground block text-sm font-medium">
                          {permission.name}
                        </span>
                        <span className="text-muted-foreground block truncate font-mono text-[11px]">
                          {permission.code}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!groups.length ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No permissions match “{search.trim()}”.
          </p>
        ) : null}
      </div>
      <Label className="sr-only">Selected permission count</Label>
    </fieldset>
  );
}
