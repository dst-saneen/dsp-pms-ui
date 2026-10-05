"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LookupService } from "@/features/lookups/services/lookup-service";
import type {
  RoleScope,
  SecurityRole,
  SecurityUserAssignmentInput,
} from "@/features/security/types";

type LookupOption = { id: string; name: string };

interface RoleAssignmentEditorProps {
  assignments: SecurityUserAssignmentInput[];
  onChange: (assignments: SecurityUserAssignmentInput[]) => void;
  roles: SecurityRole[];
  companyGroups: LookupOption[];
  companies: LookupOption[];
  isGlobal: boolean;
  actorScope?: RoleScope;
  activeCompanyGroupId?: string;
  activeCompanyId?: string;
}

interface AssignmentDraft extends SecurityUserAssignmentInput {
  roleId: string;
  scope: RoleScope;
  companyGroupId?: string;
  companyId?: string;
  branchId?: string;
}

export function RoleAssignmentEditor({
  assignments,
  onChange,
  roles,
  companyGroups,
  companies,
  isGlobal,
  actorScope,
  activeCompanyGroupId,
  activeCompanyId,
}: RoleAssignmentEditorProps) {
  const [draft, setDraft] = useState<AssignmentDraft>({
    roleId: "",
    scope: "COMPANY",
    companyGroupId: activeCompanyGroupId,
    companyId: activeCompanyId,
  });
  const branchesQuery = useQuery({
    queryKey: ["security-assignment-branches", draft.companyId],
    queryFn: () => LookupService.getBranches(draft.companyId),
    enabled: draft.scope === "BRANCH" && Boolean(draft.companyId),
  });
  const selectedRole = roles.find((role) => role.id === draft.roleId);
  const allowedScopes = useMemo(
    () => scopesForRole(selectedRole, isGlobal, actorScope),
    [actorScope, isGlobal, selectedRole]
  );
  const isComplete =
    Boolean(draft.roleId) &&
    (draft.scope === "GLOBAL" ||
      (draft.scope === "COMPANY_GROUP" && Boolean(draft.companyGroupId)) ||
      (draft.scope === "COMPANY" && Boolean(draft.companyId)) ||
      (draft.scope === "BRANCH" && Boolean(draft.companyId) && Boolean(draft.branchId)));

  function selectRole(roleId: string) {
    const role = roles.find((candidate) => candidate.id === roleId);
    const scopes = scopesForRole(role, isGlobal, actorScope);
    const scope = scopes.includes(draft.scope) ? draft.scope : scopes[0];

    setDraft((current) => ({
      ...current,
      roleId,
      scope,
      companyGroupId:
        scope === "COMPANY_GROUP"
          ? current.companyGroupId ?? activeCompanyGroupId
          : undefined,
      companyId:
        scope === "COMPANY" || scope === "BRANCH"
          ? current.companyId ?? activeCompanyId
          : undefined,
      branchId: scope === "BRANCH" ? current.branchId : undefined,
    }));
  }

  function selectScope(scope: RoleScope) {
    setDraft((current) => ({
      ...current,
      scope,
      companyGroupId:
        scope === "COMPANY_GROUP"
          ? current.companyGroupId ?? activeCompanyGroupId
          : undefined,
      companyId:
        scope === "COMPANY" || scope === "BRANCH"
          ? current.companyId ?? activeCompanyId
          : undefined,
      branchId: scope === "BRANCH" ? current.branchId : undefined,
    }));
  }

  function addAssignment() {
    if (!isComplete) return;

    const next: SecurityUserAssignmentInput = {
      roleId: draft.roleId,
      scope: draft.scope,
      companyGroupId:
        draft.scope === "COMPANY_GROUP" ? draft.companyGroupId : undefined,
      companyId:
        draft.scope === "COMPANY" || draft.scope === "BRANCH"
          ? draft.companyId
          : undefined,
      branchId: draft.scope === "BRANCH" ? draft.branchId : undefined,
    };
    const key = assignmentKey(next);

    if (!assignments.some((assignment) => assignmentKey(assignment) === key)) {
      onChange([...assignments, next]);
    }

    setDraft({
      roleId: "",
      scope: "COMPANY",
      companyGroupId: activeCompanyGroupId,
      companyId: activeCompanyId,
    });
  }

  return (
    <div className="space-y-4">
      {assignments.length ? (
        <div className="space-y-2" aria-label="Selected role assignments">
          {assignments.map((assignment, index) => {
            const role = roles.find((candidate) => candidate.id === assignment.roleId);
            return (
              <div
                key={assignmentKey(assignment)}
                className="border-border bg-muted/30 flex items-start justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-medium">
                      {role?.name ?? "Unknown role"}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {assignment.scope.replace("_", " ")} ·{" "}
                      {scopeLabel(assignment, companyGroups, companies)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    onChange(assignments.filter((_, assignmentIndex) => assignmentIndex !== index))
                  }
                  aria-label={`Remove ${role?.name ?? "role"} assignment`}
                >
                  <X className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
          Add at least one role and organization scope.
        </p>
      )}

      <div className="border-border space-y-4 rounded-lg border p-4">
        <div className="space-y-1.5">
          <Label htmlFor="role-assignment-role">Role</Label>
          <Select value={draft.roleId} onValueChange={selectRole}>
            <SelectTrigger id="role-assignment-role" className="w-full">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role-assignment-scope">Access scope</Label>
          <Select
            value={draft.scope}
            disabled={!draft.roleId || allowedScopes.length === 1}
            onValueChange={(scope: RoleScope) => selectScope(scope)}
          >
            <SelectTrigger id="role-assignment-scope" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedScopes.map((scope) => (
                <SelectItem key={scope} value={scope}>
                  {scope.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {draft.scope === "COMPANY_GROUP" ? (
          <div className="space-y-1.5">
            <Label htmlFor="role-assignment-company-group">
              Company Group
            </Label>
            <Select
              value={draft.companyGroupId}
              onValueChange={(companyGroupId) =>
                setDraft((current) => ({ ...current, companyGroupId }))
              }
            >
              <SelectTrigger
                id="role-assignment-company-group"
                className="w-full"
              >
                <SelectValue placeholder="Select a Company Group" />
              </SelectTrigger>
              <SelectContent>
                {companyGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {draft.scope === "COMPANY" || draft.scope === "BRANCH" ? (
          <div className="space-y-1.5">
            <Label htmlFor="role-assignment-company">Company</Label>
            <Select
              value={draft.companyId}
              onValueChange={(companyId) =>
                setDraft((current) => ({
                  ...current,
                  companyId,
                  branchId: undefined,
                }))
              }
            >
              <SelectTrigger id="role-assignment-company" className="w-full">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {draft.scope === "BRANCH" ? (
          <div className="space-y-1.5">
            <Label htmlFor="role-assignment-branch">Branch</Label>
            <Select
              value={draft.branchId}
              onValueChange={(branchId) =>
                setDraft((current) => ({ ...current, branchId }))
              }
              disabled={!draft.companyId}
            >
              <SelectTrigger id="role-assignment-branch" className="w-full">
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {(branchesQuery.data ?? []).map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!isComplete}
          onClick={addAssignment}
        >
          <Plus className="size-4" />
          Add role assignment
        </Button>
      </div>
    </div>
  );
}

function scopesForRole(
  role: SecurityRole | undefined,
  isGlobal: boolean,
  actorScope?: RoleScope
): RoleScope[] {
  if (role?.code === "SUPER_ADMINISTRATOR") return ["GLOBAL"];
  if (role?.code === "ORGANIZATION_OWNER") return ["COMPANY_GROUP"];

  const scopes: RoleScope[] = [];
  if (!role?.isSystem && (isGlobal || actorScope === "COMPANY_GROUP")) {
    scopes.push("COMPANY_GROUP");
  }
  scopes.push("COMPANY", "BRANCH");
  return scopes;
}

function assignmentKey(assignment: SecurityUserAssignmentInput): string {
  return [
    assignment.roleId,
    assignment.scope,
    assignment.companyGroupId,
    assignment.companyId,
    assignment.branchId,
  ].join(":");
}

function scopeLabel(
  assignment: SecurityUserAssignmentInput,
  companyGroups: LookupOption[],
  companies: LookupOption[]
): string {
  if (assignment.scope === "GLOBAL") return "All organizations";
  if (assignment.scope === "COMPANY_GROUP") {
    return (
      companyGroups.find((group) => group.id === assignment.companyGroupId)?.name ??
      "Company Group"
    );
  }
  return (
    companies.find((company) => company.id === assignment.companyId)?.name ??
    (assignment.scope === "BRANCH" ? "Selected branch" : "Company")
  );
}
