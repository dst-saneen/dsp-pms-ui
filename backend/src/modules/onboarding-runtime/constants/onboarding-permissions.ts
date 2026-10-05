/**
 * Onboarding runtime permission codes (onboarding-db-api-implementation-plan §7.1).
 */
export const ONBOARDING_PERMISSIONS = {
  READ: 'hr.onboarding.read',
  MANAGE: 'hr.onboarding.manage',
  PUBLISH: 'hr.onboarding.publish',
  DEPARTMENT_READ: 'hr.onboarding.department.read',
  DEPARTMENT_ASSIGN: 'hr.onboarding.department.assign',
  OVERRIDE: 'hr.onboarding.override',
  SELF_READ: 'hr.self.read',
} as const;

export type OnboardingPermissionCode =
  (typeof ONBOARDING_PERMISSIONS)[keyof typeof ONBOARDING_PERMISSIONS];

export const ONBOARDING_PERMISSION_CODE_VALUES = Object.values(
  ONBOARDING_PERMISSIONS,
);

/** Open task detail/history as assignee, department worker, or HR. */
export const ONBOARDING_TASK_RUNTIME_READ_ANY = [
  ONBOARDING_PERMISSIONS.SELF_READ,
  ONBOARDING_PERMISSIONS.READ,
  ONBOARDING_PERMISSIONS.DEPARTMENT_READ,
  ONBOARDING_PERMISSIONS.MANAGE,
  ONBOARDING_PERMISSIONS.OVERRIDE,
] as const;

/** Start/complete/skip assigned work without granting full HR onboarding. */
export const ONBOARDING_TASK_RUNTIME_ACT_ANY = [
  ONBOARDING_PERMISSIONS.SELF_READ,
  ONBOARDING_PERMISSIONS.MANAGE,
  ONBOARDING_PERMISSIONS.OVERRIDE,
  ONBOARDING_PERMISSIONS.DEPARTMENT_ASSIGN,
] as const;

export function hasOnboardingPermission(
  actor: { permissions: string[]; isGlobal?: boolean },
  permission: OnboardingPermissionCode,
): boolean {
  if (actor.isGlobal || actor.permissions.includes('platform.admin')) {
    return true;
  }

  return actor.permissions.includes(permission);
}
