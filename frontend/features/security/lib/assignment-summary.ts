import type {
  SecurityPermission,
  SecurityRole,
  SecurityUserAssignment,
  SecurityUserAssignmentInput,
} from "../types";

type NamedOption = { id: string; name: string };

export function assignmentKey(assignment: SecurityUserAssignmentInput): string {
  return [
    assignment.roleId,
    assignment.scope,
    assignment.companyGroupId ?? "",
    assignment.companyId ?? "",
    assignment.branchId ?? "",
  ].join(":");
}

export function toAssignmentInput(
  assignment: SecurityUserAssignment,
): SecurityUserAssignmentInput {
  return {
    roleId: assignment.role.id,
    scope: assignment.scope,
    companyGroupId: assignment.companyGroupId,
    companyId: assignment.companyId,
    branchId: assignment.branchId,
  };
}

export function describeAssignment(
  assignment: SecurityUserAssignmentInput,
  roles: SecurityRole[],
  companyGroups: NamedOption[],
  companies: NamedOption[],
): string {
  const role =
    roles.find((candidate) => candidate.id === assignment.roleId)?.name ??
    "Unknown role";
  const scope = assignment.scope.replaceAll("_", " ");

  if (assignment.scope === "GLOBAL") {
    return `${role} · ${scope} · All organizations`;
  }
  if (assignment.scope === "COMPANY_GROUP") {
    const group =
      companyGroups.find((item) => item.id === assignment.companyGroupId)
        ?.name ?? "Company Group";
    return `${role} · ${scope} · ${group}`;
  }
  const company =
    companies.find((item) => item.id === assignment.companyId)?.name ??
    "Company";
  if (assignment.scope === "BRANCH") {
    return `${role} · ${scope} · ${company} (branch selected)`;
  }
  return `${role} · ${scope} · ${company}`;
}

export function diffAssignments(
  previous: SecurityUserAssignmentInput[],
  next: SecurityUserAssignmentInput[],
) {
  const previousKeys = new Set(previous.map(assignmentKey));
  const nextKeys = new Set(next.map(assignmentKey));
  return {
    added: next.filter((item) => !previousKeys.has(assignmentKey(item))),
    removed: previous.filter((item) => !nextKeys.has(assignmentKey(item))),
    unchanged: next.filter((item) => previousKeys.has(assignmentKey(item))),
  };
}

export function diffPermissionIds(
  previous: string[],
  next: string[],
  permissions: SecurityPermission[],
) {
  const previousSet = new Set(previous);
  const nextSet = new Set(next);
  const label = (id: string) =>
    permissions.find((permission) => permission.id === id)?.name ?? id;

  return {
    added: next.filter((id) => !previousSet.has(id)).map(label),
    removed: previous.filter((id) => !nextSet.has(id)).map(label),
  };
}

export function groupPermissionsByNamespace(permissions: SecurityPermission[]) {
  return Object.entries(
    permissions.reduce<Record<string, SecurityPermission[]>>(
      (groups, permission) => {
        const namespace = permission.code.split(".")[0] || "other";
        groups[namespace] = [...(groups[namespace] ?? []), permission];
        return groups;
      },
      {},
    ),
  ).sort(([a], [b]) => a.localeCompare(b));
}
