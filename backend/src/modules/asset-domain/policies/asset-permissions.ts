/**
 * Asset permission codes and stable system role identifiers.
 */
export const ASSET_PERMISSIONS = {
  ASSETS_READ: 'assets.assets.read',
  ASSETS_MANAGE: 'assets.assets.manage',
  ASSIGNMENTS_READ: 'assets.assignments.read',
  ASSIGNMENTS_MANAGE: 'assets.assignments.manage',
  DEPARTMENT_READ: 'assets.department.read',
  DEPARTMENT_MANAGE: 'assets.department.manage',
  DEPARTMENT_ASSIGNMENTS_READ: 'assets.department.assignments.read',
  DEPARTMENT_ASSIGNMENTS_MANAGE: 'assets.department.assignments.manage',
  DEPARTMENT_ACCESS_MANAGE: 'assets.department-access.manage',
  TRANSFERS_FORCE: 'assets.transfers.force',
  CLEARANCE_WAIVE: 'assets.clearance.waive',
  CARDS_SENSITIVE_LOOKUP: 'assets.cards.sensitive.lookup',
  SENSITIVE_METADATA_READ: 'assets.sensitive-metadata.read',
  PRIVATE_HISTORY_READ: 'assets.private-history.read',
} as const;

export type AssetPermissionCode =
  (typeof ASSET_PERMISSIONS)[keyof typeof ASSET_PERMISSIONS];

/** Tenant-assignable department operational permissions only. */
export const ASSET_TENANT_ASSIGNABLE_PERMISSIONS = [
  ASSET_PERMISSIONS.DEPARTMENT_READ,
  ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_READ,
  ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_MANAGE,
] as const satisfies readonly AssetPermissionCode[];

/** Protected system permissions for Assets. */
export const ASSET_PROTECTED_PERMISSIONS = [
  ASSET_PERMISSIONS.DEPARTMENT_ACCESS_MANAGE,
  ASSET_PERMISSIONS.TRANSFERS_FORCE,
  ASSET_PERMISSIONS.CLEARANCE_WAIVE,
  ASSET_PERMISSIONS.CARDS_SENSITIVE_LOOKUP,
  ASSET_PERMISSIONS.SENSITIVE_METADATA_READ,
  ASSET_PERMISSIONS.PRIVATE_HISTORY_READ,
] as const satisfies readonly AssetPermissionCode[];

export const ASSET_DEPARTMENT_CUSTODIAN_ROLE = {
  id: '00000000-0000-4000-8000-000000000008',
  code: 'ASSET_DEPARTMENT_CUSTODIAN',
  name: 'Asset Department Custodian',
} as const;

/** Broad read or department read; used with @RequireAnyPermissions. */
export const ASSET_INVENTORY_READ_PERMISSIONS = [
  ASSET_PERMISSIONS.ASSETS_READ,
  ASSET_PERMISSIONS.DEPARTMENT_READ,
] as const;

/** Broad custody read OR department custody read. */
export const ASSET_CUSTODY_READ_PERMISSIONS = [
  ASSET_PERMISSIONS.ASSIGNMENTS_READ,
  ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_READ,
] as const;

/** Broad custody manage OR department custody manage. */
export const ASSET_CUSTODY_MANAGE_PERMISSIONS = [
  ASSET_PERMISSIONS.ASSIGNMENTS_MANAGE,
  ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_MANAGE,
] as const;
