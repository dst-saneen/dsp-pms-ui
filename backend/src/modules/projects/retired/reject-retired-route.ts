import { GoneException } from '@nestjs/common';

import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';

/**
 * Flat scaffolding routes are superseded by nested /projects/:id/... commands.
 * Returns HTTP 410 so clients stop using both reads and writes.
 */
export function rejectRetiredProjectsRoute(): never {
  throw new GoneException({
    code: PROJECTS_ERROR_CODES.PROJECTS_LEGACY_ROUTE_DISABLED,
    message:
      'Retired project scaffolding routes are unavailable. Use nested /projects, /me/project-tasks, /me/timesheets, and /team/timesheets APIs.',
  });
}

/** @deprecated Prefer rejectRetiredProjectsRoute — same stable error code. */
export function rejectRetiredProjectsMutation(): never {
  return rejectRetiredProjectsRoute();
}
