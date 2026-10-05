"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";

import {
  describeAssignment,
  diffAssignments,
  diffPermissionIds,
} from "../lib/assignment-summary";
import type {
  SecurityPermission,
  SecurityRole,
  SecurityUserAssignmentInput,
} from "../types";

type NamedOption = { id: string; name: string };

interface AssignmentSummaryProps {
  mode: "assignments";
  assignments: SecurityUserAssignmentInput[];
  previousAssignments?: SecurityUserAssignmentInput[];
  roles: SecurityRole[];
  companyGroups: NamedOption[];
  companies: NamedOption[];
  warnSessionRevoke?: boolean;
}

interface PermissionSummaryProps {
  mode: "permissions";
  permissionIds: string[];
  previousPermissionIds?: string[];
  permissions: SecurityPermission[];
}

type EffectiveAccessSummaryProps =
  | AssignmentSummaryProps
  | PermissionSummaryProps;

export function EffectiveAccessSummary(props: EffectiveAccessSummaryProps) {
  if (props.mode === "permissions") {
    const previous = props.previousPermissionIds ?? [];
    const delta = diffPermissionIds(
      previous,
      props.permissionIds,
      props.permissions,
    );
    const showDelta = previous.length > 0;

    return (
      <section
        className="border-border bg-muted/20 space-y-3 rounded-xl border p-4"
        aria-label="Effective access summary"
      >
        <header className="flex items-start gap-2">
          <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
          <div>
            <h2 className="text-foreground text-sm font-semibold">
              Permission summary
            </h2>
            <p className="text-muted-foreground text-xs">
              Review what this role will grant before saving.
            </p>
          </div>
        </header>
        <p className="text-foreground text-sm">
          {props.permissionIds.length} permission
          {props.permissionIds.length === 1 ? "" : "s"} selected
        </p>
        {showDelta ? (
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <DeltaList title="Added" items={delta.added} empty="None" />
            <DeltaList title="Removed" items={delta.removed} empty="None" />
          </div>
        ) : null}
      </section>
    );
  }

  const previous = props.previousAssignments ?? [];
  const delta = diffAssignments(previous, props.assignments);
  const showDelta = previous.length > 0;
  const lines = props.assignments.map((assignment) =>
    describeAssignment(
      assignment,
      props.roles,
      props.companyGroups,
      props.companies,
    ),
  );

  const companies = [
    ...new Set(
      props.assignments
        .filter((item) => item.companyId)
        .map((item) => {
          const name =
            props.companies.find((company) => company.id === item.companyId)
              ?.name ?? item.companyId;
          return name!;
        }),
    ),
  ];
  const groups = [
    ...new Set(
      props.assignments
        .filter((item) => item.companyGroupId)
        .map((item) => {
          const name =
            props.companyGroups.find((group) => group.id === item.companyGroupId)
              ?.name ?? item.companyGroupId;
          return name!;
        }),
    ),
  ];

  return (
    <section
      className="border-border bg-muted/20 space-y-3 rounded-xl border p-4"
      aria-label="Effective access summary"
    >
      <header className="flex items-start gap-2">
        <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
        <div>
          <h2 className="text-foreground text-sm font-semibold">
            Effective access summary
          </h2>
          <p className="text-muted-foreground text-xs">
            Confirm roles and organization scope before submit.
          </p>
        </div>
      </header>

      {lines.length ? (
        <ul className="space-y-1.5 text-sm">
          {lines.map((line) => (
            <li key={line} className="text-foreground">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">
          No role assignments yet.
        </p>
      )}

      {(groups.length > 0 || companies.length > 0) && (
        <p className="text-muted-foreground text-xs">
          {groups.length
            ? `Company Groups: ${groups.join(", ")}`
            : null}
          {groups.length && companies.length ? " · " : null}
          {companies.length ? `Companies: ${companies.join(", ")}` : null}
        </p>
      )}

      {showDelta ? (
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <DeltaList
            title="Added"
            items={delta.added.map((item) =>
              describeAssignment(
                item,
                props.roles,
                props.companyGroups,
                props.companies,
              ),
            )}
            empty="None"
          />
          <DeltaList
            title="Removed"
            items={delta.removed.map((item) =>
              describeAssignment(
                item,
                props.roles,
                props.companyGroups,
                props.companies,
              ),
            )}
            empty="None"
          />
        </div>
      ) : null}

      {props.warnSessionRevoke ? (
        <p className="text-warning flex items-start gap-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Saving replaces access and revokes all of this user’s active sessions.
        </p>
      ) : null}
    </section>
  );
}

function DeltaList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="border-border rounded-lg border bg-background/60 p-3">
      <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wide">
        {title}
      </p>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={`${title}-${item}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}
