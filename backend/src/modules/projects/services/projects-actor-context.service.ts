import { Injectable } from '@nestjs/common';

import type { AuthenticatedUser } from '../../auth/auth.types';
import type { ProjectsActorContext } from '../types/project.types';

@Injectable()
export class ProjectsActorContextService {
  resolve(user: AuthenticatedUser): ProjectsActorContext {
    return {
      userId: user.id,
      employeeId: user.employeeId,
      permissions: user.authorization.permissions,
      companyId: user.authorization.activeCompanyId,
      branchId: user.authorization.activeBranchId,
    };
  }

  hasPermission(actor: ProjectsActorContext, permission: string): boolean {
    return actor.permissions.includes(permission);
  }
}
