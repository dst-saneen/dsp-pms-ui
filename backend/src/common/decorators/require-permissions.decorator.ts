import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const REQUIRED_ANY_PERMISSIONS_KEY = 'requiredAnyPermissions';

/** Caller must hold every listed permission (AND). */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/**
 * Caller must hold at least one listed permission (OR).
 * Use for reporting-manager approvals (`hr.team.approve` or domain approve).
 * Does not change AND behavior of RequirePermissions.
 */
export const RequireAnyPermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_ANY_PERMISSIONS_KEY, permissions);
