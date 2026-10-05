import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../../auth';
import { FileStorageFeatureService } from '../services/file-storage-feature.service';

/** Blocks authenticated File Operations unless the selected Company is entitled. */
@Injectable()
export class FileStorageEnabledGuard implements CanActivate {
  constructor(private readonly features: FileStorageFeatureService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const companyId = request.user?.authorization.activeCompanyId;

    if (companyId && (await this.features.isScopeAllowed(companyId, null))) {
      return true;
    }

    throw new ForbiddenException({
      code: 'FILE_STORAGE_MODULE_NOT_ENABLED',
      message: 'Select a Company with File Storage enabled.',
    });
  }
}
