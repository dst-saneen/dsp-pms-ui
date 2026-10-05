import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest, AuthenticatedUser } from '../auth';
import { randomUUID } from 'crypto';
import { S3StorageAdapter } from './adapters/s3-storage.adapter';
import { FileStorageEnabledGuard } from './guards/file-storage-enabled.guard';
import { FileReconciliationService } from './services/file-reconciliation.service';
import { FileRetentionService } from './services/file-retention.service';
import { ClamAvScannerWorker } from './workers/clamav-scanner.worker';

function requireActiveCompanyId(user: AuthenticatedUser): string {
  const companyId = user.authorization.activeCompanyId;
  if (!companyId) {
    throw new ForbiddenException({
      code: 'ACTIVE_COMPANY_REQUIRED',
      message: 'An active company is required.',
    });
  }
  return companyId;
}

@UseGuards(FileStorageEnabledGuard)
@Controller()
export class FileOperationsController {
  constructor(
    private readonly retention: FileRetentionService,
    private readonly reconciliation: FileReconciliationService,
    private readonly storage: S3StorageAdapter,
    private readonly scanner: ClamAvScannerWorker,
  ) {}

  @Get('admin/operations/files/stats')
  @RequirePermissions('files.operations.read')
  async stats(@Req() request: AuthenticatedRequest) {
    const companyId = requireActiveCompanyId(request.user);
    const [counts, storage, clamav] = await Promise.all([
      this.retention.getOperationsStats(companyId),
      this.storage.checkReadiness(),
      this.scanner.checkReadiness(),
    ]);
    return {
      ...counts,
      storageHealthy: storage.healthy,
      storageEncryptionEnabled: storage.encryptionEnabled,
      clamAvHealthy: clamav.healthy,
      clamAvVersion: clamav.version,
      clamAvMode: clamav.mode,
    };
  }

  @Get('admin/operations/files')
  @RequirePermissions('files.operations.read')
  async list(@Req() request: AuthenticatedRequest) {
    return this.retention.getOperationsStats(
      requireActiveCompanyId(request.user),
    );
  }

  @Post('admin/operations/files/reconcile')
  @RequirePermissions('files.operations.manage')
  async reconcile(
    @Req() request: AuthenticatedRequest,
    @Body() body: { operationId?: string },
  ) {
    const report = await this.reconciliation.reconcileCompany(
      requireActiveCompanyId(request.user),
    );
    return {
      ...report,
      operationId:
        typeof body?.operationId === 'string' && body.operationId.trim()
          ? body.operationId.trim()
          : randomUUID(),
    };
  }

  @Post('admin/operations/files/clear-scan-failures')
  @RequirePermissions('files.operations.manage')
  async clearScanFailures(@Req() request: AuthenticatedRequest) {
    return this.retention.clearFalseScanFailures(
      requireActiveCompanyId(request.user),
    );
  }

  @Get('settings/security/document-retention')
  @RequirePermissions('files.retention.manage')
  async listPolicies(@Req() request: AuthenticatedRequest) {
    return this.retention.listPolicies(requireActiveCompanyId(request.user));
  }

  @Patch('settings/security/document-retention/:retentionClass')
  @RequirePermissions('files.retention.manage')
  async upsertPolicy(
    @Param('retentionClass') retentionClass: string,
    @Body()
    body: {
      retentionRule: string;
      retentionValue: number;
      enabled?: boolean;
      approve?: boolean;
    },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.retention.upsertPolicy({
      companyId: requireActiveCompanyId(request.user),
      actorUserId: request.user.id,
      retentionClass,
      retentionRule: body.retentionRule,
      retentionValue: body.retentionValue,
      enabled: body.enabled,
      approve: body.approve,
    });
  }
}
