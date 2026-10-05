import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { SkipResponseEnvelope } from '../../common/decorators/skip-response-envelope.decorator';
import type { AuthenticatedRequest } from '../auth';
import { BusinessCalendarPermission } from './business-calendar.permissions';
import { BusinessCalendarImportService } from './business-calendar-import.service';
import {
  CreateImportBatchDto,
  GovernmentImportDto,
  ListImportBatchesQueryDto,
  ReviewImportBatchDto,
} from './dto/business-calendar-import.dto';

@ApiTags('Business Calendar Imports')
@Controller('business-calendar-imports')
export class BusinessCalendarImportController {
  constructor(private readonly imports: BusinessCalendarImportService) {}

  @Get('template.csv')
  @SkipResponseEnvelope()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="business-calendar-import-template.csv"',
  )
  @RequirePermissions(BusinessCalendarPermission.IMPORT)
  template() {
    return this.imports.getTemplateCsv();
  }

  @Get('template.xlsx')
  @SkipResponseEnvelope()
  @RequirePermissions(BusinessCalendarPermission.IMPORT)
  async templateExcel(): Promise<StreamableFile> {
    const buffer = await this.imports.getTemplateExcel();
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition:
        'attachment; filename="business-calendar-import-template.xlsx"',
    });
  }

  @Get('jurisdictions')
  @RequirePermissions(BusinessCalendarPermission.READ)
  jurisdictions() {
    return this.imports.listJurisdictions();
  }

  @Get()
  @RequirePermissions(BusinessCalendarPermission.READ)
  list(@Query() query: ListImportBatchesQueryDto) {
    return this.imports.listBatches(query);
  }

  @Get(':batchId')
  @RequirePermissions(BusinessCalendarPermission.READ)
  get(@Param('batchId') batchId: string) {
    return this.imports.getBatch(batchId);
  }

  @Post()
  @RequirePermissions(BusinessCalendarPermission.IMPORT)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['calendarVersionId', 'file'],
      properties: {
        calendarVersionId: { type: 'string', format: 'uuid' },
        sourceKind: { type: 'string', enum: ['CSV', 'EXCEL', 'ICS'] },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  upload(
    @Req() request: AuthenticatedRequest,
    @UploadedFile()
    file: Express.Multer.File | undefined,
    @Body() dto: CreateImportBatchDto,
  ) {
    if (!file?.buffer?.length) {
      return this.imports.uploadFile({
        calendarVersionId: dto.calendarVersionId,
        fileName: 'missing',
        buffer: Buffer.alloc(0),
        actorUserId: request.user.id,
        sourceKind: dto.sourceKind,
      });
    }
    return this.imports.uploadFile({
      calendarVersionId: dto.calendarVersionId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      actorUserId: request.user.id,
      sourceKind: dto.sourceKind,
    });
  }

  @Post('government')
  @RequirePermissions(BusinessCalendarPermission.IMPORT)
  government(
    @Req() request: AuthenticatedRequest,
    @Body() dto: GovernmentImportDto,
  ) {
    return this.imports.importFromGovernment(dto, request.user.id);
  }

  @Post(':batchId/validate')
  @RequirePermissions(BusinessCalendarPermission.IMPORT)
  validate(
    @Req() request: AuthenticatedRequest,
    @Param('batchId') batchId: string,
  ) {
    return this.imports.validate(batchId, request.user.id);
  }

  @Post(':batchId/review')
  @RequirePermissions(BusinessCalendarPermission.REVIEW)
  review(
    @Req() request: AuthenticatedRequest,
    @Param('batchId') batchId: string,
    @Body() dto: ReviewImportBatchDto,
  ) {
    return this.imports.review(batchId, dto, request.user.id);
  }

  @Post(':batchId/apply-to-draft')
  @RequirePermissions(BusinessCalendarPermission.IMPORT)
  apply(
    @Req() request: AuthenticatedRequest,
    @Param('batchId') batchId: string,
  ) {
    return this.imports.applyToDraft(batchId, request.user.id);
  }

  @Post(':batchId/reject')
  @RequirePermissions(BusinessCalendarPermission.REVIEW)
  reject(
    @Req() request: AuthenticatedRequest,
    @Param('batchId') batchId: string,
  ) {
    return this.imports.reject(batchId, request.user.id);
  }
}
