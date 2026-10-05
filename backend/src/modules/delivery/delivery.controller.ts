import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequireAnyPermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';
import { OrganizationScopeService } from '../auth/organization-scope.service';

import { DeliveryEmailWorker } from './delivery-email.worker';
import { DeliveryFeatureGateService } from './delivery-feature-gate.service';
import { DeliveryEnabledGuard } from './guards/delivery-enabled.guard';
import { DeliveryJobsScheduler } from './delivery-jobs.scheduler';
import { DeliveryQueryService } from './delivery-query.service';
import { DeliverySuppressionService } from './delivery-suppression.service';
import { DeliveryRecipientExceptionService } from './resolution/delivery-recipient-exception.service';
import {
  CancelDeliveryDto,
  ReleaseSuppressionDto,
  RetryDeliveryDto,
} from './dto/delivery-command.dto';
import { ListDeliveryMessagesDto } from './dto/list-delivery-messages.dto';

@ApiTags('Delivery')
@UseGuards(DeliveryEnabledGuard)
@Controller('delivery')
export class DeliveryController {
  constructor(
    private readonly query: DeliveryQueryService,
    private readonly emailWorker: DeliveryEmailWorker,
    private readonly suppression: DeliverySuppressionService,
    private readonly recipientExceptions: DeliveryRecipientExceptionService,
    private readonly scope: OrganizationScopeService,
    private readonly featureGate: DeliveryFeatureGateService,
    private readonly jobsScheduler: DeliveryJobsScheduler,
  ) {}

  @Get('messages')
  @RequireAnyPermissions(
    'hr.recruitment.delivery.read',
    'platform.delivery.read',
  )
  @ApiOperation({ summary: 'List delivery messages (scoped by role)' })
  async listMessages(
    @Query() dto: ListDeliveryMessagesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const org = this.scope.current();
    return this.query.listMessages({
      status: dto.status,
      channel: dto.channel,
      eventType: dto.eventType,
      keyword: dto.keyword,
      recipientId: dto.recipientId,
      fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
      toDate: dto.toDate ? new Date(dto.toDate) : undefined,
      companyId: this.scope.companyIdOrUndefined(),
      branchId: this.scope.branchIdOrUndefined(),
      filterCompanyId: org.isGlobal ? dto.companyId : undefined,
      filterBranchId: org.isGlobal ? dto.branchId : undefined,
      page: dto.page,
      limit: dto.limit,
      sortBy: dto.sortBy,
      sortOrder: dto.sortOrder,
      canRetry: true,
      canCancel: this.canCancelDelivery(request),
    });
  }

  @Get('messages/:id')
  @RequireAnyPermissions(
    'hr.recruitment.delivery.read',
    'platform.delivery.read',
  )
  @ApiOperation({ summary: 'Get delivery message detail' })
  async getMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const message = await this.query.getMessage(id, {
      companyId: this.scope.companyIdOrUndefined(),
      branchId: this.scope.branchIdOrUndefined(),
      canRetry: true,
      canCancel: this.canCancelDelivery(request),
    });
    if (!message) throw new NotFoundException('Delivery message not found.');
    return message;
  }

  @Get('messages/:id/attempts')
  @RequireAnyPermissions(
    'hr.recruitment.delivery.read',
    'platform.delivery.read',
  )
  @ApiOperation({ summary: 'List delivery attempts for a message' })
  async getAttempts(@Param('id', ParseUUIDPipe) id: string) {
    const message = await this.query.getMessage(id, {
      companyId: this.scope.companyIdOrUndefined(),
      branchId: this.scope.branchIdOrUndefined(),
    });
    if (!message) throw new NotFoundException('Delivery message not found.');
    return this.query.getAttempts(id);
  }

  @Post('messages/:id/retry')
  @HttpCode(200)
  @RequireAnyPermissions(
    'hr.recruitment.delivery.retry',
    'platform.delivery.retry',
  )
  @ApiOperation({ summary: 'Retry a dead-lettered or failed delivery message' })
  async retry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RetryDeliveryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const message = await this.query.getMessage(id, {
      companyId: this.scope.companyIdOrUndefined(),
      branchId: this.scope.branchIdOrUndefined(),
      canRetry: true,
    });
    if (!message) throw new NotFoundException('Delivery message not found.');
    await this.emailWorker.retry(id, {
      operationId: dto.operationId,
      expectedVersion: dto.expectedVersion,
      reason: dto.reason,
      actorUserId: request.user.id,
    });
    return this.query.getMessage(id, {
      companyId: this.scope.companyIdOrUndefined(),
      branchId: this.scope.branchIdOrUndefined(),
      canRetry: true,
      canCancel: this.canCancelDelivery(request),
    });
  }

  @Post('messages/:id/cancel')
  @HttpCode(200)
  @RequireAnyPermissions(
    'hr.recruitment.delivery.retry',
    'platform.delivery.retry',
  )
  @ApiOperation({ summary: 'Cancel a queued delivery message (ops only)' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelDeliveryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const message = await this.query.getMessage(id, {
      companyId: this.scope.companyIdOrUndefined(),
      branchId: this.scope.branchIdOrUndefined(),
      canCancel: true,
    });
    if (!message) throw new NotFoundException('Delivery message not found.');
    await this.emailWorker.cancel(id, {
      operationId: dto.operationId,
      expectedVersion: dto.expectedVersion,
      reason: dto.reason,
      actorUserId: request.user.id,
    });
    return this.query.getMessage(id, {
      companyId: this.scope.companyIdOrUndefined(),
      branchId: this.scope.branchIdOrUndefined(),
      canCancel: true,
    });
  }

  @Get('dead-letters')
  @RequireAnyPermissions(
    'hr.recruitment.delivery.read',
    'platform.delivery.read',
  )
  @ApiOperation({ summary: 'List dead-lettered messages (ops only)' })
  listDeadLetters(
    @Query() dto: ListDeliveryMessagesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const org = this.scope.current();
    return this.query.listDeadLetters({
      companyId: this.scope.companyIdOrUndefined(),
      branchId: this.scope.branchIdOrUndefined(),
      filterCompanyId: org.isGlobal ? dto.companyId : undefined,
      filterBranchId: org.isGlobal ? dto.branchId : undefined,
      page: dto.page,
      limit: dto.limit,
      canRetry: true,
      canCancel: this.canCancelDelivery(request),
    });
  }

  @Get('recipient-exceptions')
  @RequireAnyPermissions(
    'hr.recruitment.delivery.read',
    'platform.delivery.read',
  )
  @ApiOperation({ summary: 'List redacted recipient-resolution exceptions' })
  listRecipientExceptions(@Query() dto: ListDeliveryMessagesDto) {
    return this.query.listRecipientExceptions({
      companyId: this.scope.companyIdOrUndefined(),
      branchId: this.scope.branchIdOrUndefined(),
      page: dto.page,
      limit: dto.limit,
    });
  }

  @Post('recipient-exceptions/:id/resolve')
  @HttpCode(200)
  @RequireAnyPermissions(
    'hr.recruitment.delivery.retry',
    'platform.delivery.retry',
  )
  @ApiOperation({
    summary: 'Resolve a redacted recipient-resolution exception',
  })
  async resolveRecipientException(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReleaseSuppressionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.recipientExceptions.resolve({
      id,
      companyId: this.scope.companyIdOrUndefined(),
      branchId: this.scope.branchIdOrUndefined(),
      expectedVersion: dto.expectedVersion,
      operationId: dto.operationId,
      actorUserId: request.user.id,
      reason: dto.reason,
    });
    return { resolved: true };
  }

  @Get('suppressions')
  @RequireAnyPermissions(
    'hr.recruitment.delivery.read',
    'platform.delivery.read',
  )
  @ApiOperation({ summary: 'List active email suppressions (ops only)' })
  listSuppressions(@Query() dto: ListDeliveryMessagesDto) {
    return this.query.listSuppressions({
      companyId: this.scope.companyIdOrUndefined(),
      page: dto.page,
      limit: dto.limit,
    });
  }

  @Post('suppressions/:id/release')
  @HttpCode(200)
  @RequireAnyPermissions(
    'hr.recruitment.delivery.retry',
    'platform.delivery.retry',
  )
  @ApiOperation({ summary: 'Release an email suppression (ops only)' })
  async releaseSuppression(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReleaseSuppressionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.suppression.release({
      suppressionId: id,
      companyId: this.scope.companyIdOrUndefined(),
      releasedBy: request.user.id,
      operationId: dto.operationId,
      expectedVersion: dto.expectedVersion,
      reason: dto.reason,
    });
    return { released: true };
  }

  @Get('health')
  @RequireAnyPermissions(
    'hr.recruitment.delivery.read',
    'platform.delivery.read',
  )
  @ApiOperation({
    summary: 'Delivery queue health and resolved operating mode (no secrets)',
  })
  async health() {
    const health = await this.query.getHealth();
    return {
      deliveryEnabled: await this.featureGate.isEnabledForCompany(
        this.scope.companyIdOrUndefined(),
      ),
      jobs: await this.jobsScheduler.getHealth(),
      queue: health.queue,
      openRecipientExceptions: health.openRecipientExceptions,
    };
  }

  private hasPermission(request: AuthenticatedRequest, code: string): boolean {
    return Boolean(
      request.user?.authorization?.permissions?.includes(code) ||
      request.user?.authorization?.isGlobal,
    );
  }

  private canCancelDelivery(request: AuthenticatedRequest): boolean {
    return (
      this.hasPermission(request, 'platform.delivery.retry') ||
      this.hasPermission(request, 'hr.recruitment.delivery.retry')
    );
  }
}
