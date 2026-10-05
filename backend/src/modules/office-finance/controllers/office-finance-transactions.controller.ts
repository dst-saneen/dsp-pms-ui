import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../auth';

import {
  CreateFinanceTransactionDto,
  SearchFinanceTransactionDto,
  UpdateFinanceTransactionDto,
} from '../dto/finance-transaction.dto';
import {
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from '../dto/versioned-command.dto';
import { OfficeFinanceFeatureGuard } from '../guards/office-finance-feature.guard';
import { createOfficeFinanceAccessContext } from '../office-finance-access.types';
import {
  CreateFinanceUploadSessionDto,
  LinkFinanceAttachmentDto,
  OfficeFinanceAttachmentsService,
} from '../services/office-finance-attachments.service';
import { OfficeFinanceTransactionsService } from '../services/office-finance-transactions.service';

@ApiTags('Office Finance Transactions')
@Controller('office-finance/transactions')
@UseGuards(OfficeFinanceFeatureGuard)
export class OfficeFinanceTransactionsController {
  constructor(
    private readonly transactions: OfficeFinanceTransactionsService,
    private readonly attachments: OfficeFinanceAttachmentsService,
  ) {}

  @Get()
  @RequirePermissions('finance.transactions.read')
  findAll(
    @Query() query: SearchFinanceTransactionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactions.findPage(
      query,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post()
  @RequirePermissions('finance.transactions.manage')
  create(
    @Body() dto: CreateFinanceTransactionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactions.create(
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get(':id/history')
  @RequirePermissions('finance.transactions.read')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactions.findHistory(
      id,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get(':id')
  @RequirePermissions('finance.transactions.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactions.findOne(
      id,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Patch(':id')
  @RequirePermissions('finance.transactions.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinanceTransactionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactions.update(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/submit')
  @RequirePermissions('finance.transactions.manage')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactions.submit(
      id,
      { ...dto, reason: 'Submitted' },
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/approve')
  @RequirePermissions('finance.transactions.approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactions.approve(
      id,
      { ...dto, reason: 'Approved' },
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/return')
  @RequirePermissions('finance.transactions.approve')
  returnToDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedReasonCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactions.returnToDraft(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/cancel')
  @RequirePermissions('finance.transactions.manage')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedReasonCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactions.cancel(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/reverse')
  @RequirePermissions('finance.transactions.reverse')
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedReasonCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transactions.reverse(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get(':id/attachments')
  @RequirePermissions('finance.transactions.read')
  listAttachments(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attachments.listAttachments(
      id,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/upload-sessions')
  @RequireAnyPermissions(
    'finance.transactions.manage',
    'finance.transactions.approve',
  )
  createUploadSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFinanceUploadSessionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attachments.createUploadSession(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/upload-sessions/:sessionId/finalize')
  @HttpCode(HttpStatus.OK)
  @RequireAnyPermissions(
    'finance.transactions.manage',
    'finance.transactions.approve',
  )
  finalizeUploadSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Headers('x-file-session-token') sessionToken: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const context = createOfficeFinanceAccessContext(request.user);
    return this.attachments.finalizeUploadSession(
      id,
      sessionId,
      sessionToken,
      context,
    );
  }

  @Get(':id/upload-sessions/:sessionId')
  @RequireAnyPermissions(
    'finance.transactions.read',
    'finance.transactions.manage',
    'finance.transactions.approve',
  )
  getUploadSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Headers('x-file-session-token') sessionToken: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    const context = createOfficeFinanceAccessContext(request.user);
    return this.attachments.getUploadSession(
      id,
      sessionId,
      sessionToken,
      context,
    );
  }

  @Post(':id/attachments')
  @RequireAnyPermissions(
    'finance.transactions.manage',
    'finance.transactions.approve',
  )
  linkAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkFinanceAttachmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attachments.linkAttachment(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/attachments/:attachmentId/download-grant')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('finance.transactions.read')
  downloadGrant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attachments.createDownloadGrant(
      id,
      attachmentId,
      createOfficeFinanceAccessContext(request.user),
      request.headers['x-request-id'] as string | undefined,
    );
  }
}
