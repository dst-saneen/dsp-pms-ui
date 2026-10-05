import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessCalendarScope,
  CalendarEventTargetType,
  CalendarImportRowStatus,
  CalendarImportStatus,
  CalendarSourceKind,
  Prisma,
} from '@prisma/client';
import { createHash } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth';
import { BusinessCalendarErrorCode } from './business-calendar-error-codes';
import {
  buildCsvTemplate,
  buildExcelTemplate,
  checksumBuffer,
  detectSourceKind,
  parseImportFile,
  payloadHash,
  sanitizeFileName,
  validateUploadMeta,
  IMPORT_COUNTRY_REQUIRED_ERROR,
  type ImportGeographyFallback,
  type ParsedImportRow,
} from './business-calendar-import.parsers';
import { BusinessCalendarVersionService } from './business-calendar-version.service';
import { FixtureGovernmentHolidayProvider } from './providers/fixture-government-holiday.provider';
import { fixturePackChecksum } from './providers/holiday-fixtures';
import type { NormalizedHoliday } from './providers/government-holiday-provider';
import {
  GovernmentImportDto,
  ListImportBatchesQueryDto,
  ReviewImportBatchDto,
} from './dto/business-calendar-import.dto';

function systemMetadataId(kind: string, code: string): string {
  return createHash('md5')
    .update(`business-calendar-event-${kind}:GLOBAL:${code}`)
    .digest('hex');
}

@Injectable()
export class BusinessCalendarImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
    private readonly versions: BusinessCalendarVersionService,
    private readonly governmentProvider: FixtureGovernmentHolidayProvider,
  ) {}

  getTemplateCsv(): string {
    return buildCsvTemplate();
  }

  getTemplateExcel(): Promise<Buffer> {
    return buildExcelTemplate();
  }

  listJurisdictions() {
    return this.governmentProvider.listJurisdictions();
  }

  async listBatches(query: ListImportBatchesQueryDto) {
    const where: Prisma.BusinessCalendarImportBatchWhereInput = {
      company: this.employeeDomainScope.companyWhere(),
    };
    if (query.companyId) {
      await this.employeeDomainScope.assertCompanyInScope(query.companyId);
      where.companyId = query.companyId;
    }
    if (query.calendarId) where.calendarId = query.calendarId;
    if (query.calendarVersionId) {
      where.calendarVersionId = query.calendarVersionId;
    }

    return this.prisma.businessCalendarImportBatch.findMany({
      where,
      include: {
        rows: { select: { id: true, status: true, rowNumber: true } },
        eventSource: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getBatch(batchId: string) {
    const batch = await this.prisma.businessCalendarImportBatch.findFirst({
      where: {
        id: batchId,
        company: this.employeeDomainScope.companyWhere(),
      },
      include: {
        rows: { orderBy: { rowNumber: 'asc' } },
        eventSource: true,
        calendarVersion: true,
      },
    });
    if (!batch) {
      throw new NotFoundException({
        code: BusinessCalendarErrorCode.CALENDAR_NOT_FOUND,
        message: 'Import batch not found',
      });
    }
    await this.employeeDomainScope.assertCompanyInScope(batch.companyId);
    return batch;
  }

  async uploadFile(input: {
    calendarVersionId: string;
    fileName: string;
    mimeType?: string;
    buffer: Buffer;
    actorUserId: string;
    sourceKind?: 'CSV' | 'EXCEL' | 'ICS';
  }) {
    const metaError = validateUploadMeta({
      fileName: input.fileName,
      mimeType: input.mimeType,
      size: input.buffer.length,
    });
    if (metaError) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: metaError,
      });
    }

    const version = await this.requireDraftVersion(input.calendarVersionId);
    const fallbackGeography = await this.resolveFallbackGeography(version);
    const kind = (input.sourceKind ??
      detectSourceKind(input.fileName)) as CalendarSourceKind;
    const source = await this.requireSource(kind);
    const checksum = checksumBuffer(input.buffer);

    let parsed: ParsedImportRow[];
    try {
      parsed = await parseImportFile({
        fileName: input.fileName,
        buffer: input.buffer,
        fallbackGeography,
      });
    } catch (error) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message:
          error instanceof Error ? error.message : 'Failed to parse file',
      });
    }

    if (
      !fallbackGeography &&
      parsed.some((row) => row.errors.includes(IMPORT_COUNTRY_REQUIRED_ERROR))
    ) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message:
          'Configure the target Branch country or Company legal country, or provide countryCode for every imported row.',
      });
    }

    return this.persistBatch({
      version,
      sourceId: source.id,
      sourceKind: kind,
      sourceFileName: sanitizeFileName(input.fileName),
      sourceChecksum: checksum,
      actorUserId: input.actorUserId,
      parsed,
    });
  }

  async importFromGovernment(dto: GovernmentImportDto, actorUserId: string) {
    const version = await this.requireDraftVersion(dto.calendarVersionId);
    const source = await this.requireSource(CalendarSourceKind.GOVERNMENT_API);

    let holidays: NormalizedHoliday[];
    try {
      holidays = await this.governmentProvider.fetchHolidays({
        countryCode: dto.countryCode,
        subdivisionCode: dto.subdivisionCode,
        year: dto.year,
      });
    } catch (error) {
      const providerError = error as Error & { code?: string };
      const failureReason =
        providerError.message || 'Government holiday provider unavailable';
      const failed = await this.prisma.businessCalendarImportBatch.create({
        data: {
          companyId: version.calendar.companyId,
          calendarId: version.calendarId,
          calendarVersionId: version.id,
          eventSourceId: source.id,
          sourceKind: CalendarSourceKind.GOVERNMENT_API,
          sourceFileName: sanitizeFileName(
            `government-${dto.countryCode}-${dto.year}.json`,
          ),
          sourceChecksum: createHash('sha256')
            .update(
              JSON.stringify({
                countryCode: dto.countryCode,
                subdivisionCode: dto.subdivisionCode ?? null,
                year: dto.year,
                error: true,
              }),
            )
            .digest('hex'),
          status: CalendarImportStatus.FAILED,
          uploadedByUserId: actorUserId,
          totalRows: 0,
        },
      });

      await this.auditService.log(
        'BusinessCalendarImportBatch',
        failed.id,
        'GOVERNMENT_IMPORT_FAILED',
        undefined,
        {
          countryCode: dto.countryCode,
          year: dto.year,
          resumable: true,
          reason: failureReason,
          providerCode:
            providerError.code ??
            BusinessCalendarErrorCode.CALENDAR_GOVERNMENT_PROVIDER_UNAVAILABLE,
        },
        { userId: actorUserId },
      );

      throw new BadRequestException({
        code:
          providerError.code ??
          BusinessCalendarErrorCode.CALENDAR_GOVERNMENT_PROVIDER_UNAVAILABLE,
        message: `${failureReason} A FAILED audit batch was retained for traceability.`,
        batchId: failed.id,
      });
    }

    const parsed: ParsedImportRow[] = holidays.map((holiday, index) => ({
      rowNumber: index + 1,
      raw: holiday as unknown as Record<string, string>,
      normalized: holiday,
      errors: [],
    }));

    return this.persistBatch({
      version,
      sourceId: source.id,
      sourceKind: CalendarSourceKind.GOVERNMENT_API,
      sourceFileName: sanitizeFileName(
        `government-${dto.countryCode}-${dto.subdivisionCode ?? 'national'}-${dto.year}.json`,
      ),
      sourceChecksum: fixturePackChecksum(holidays),
      actorUserId,
      parsed,
    });
  }

  async validate(batchId: string, actorUserId: string) {
    const batch = await this.getBatch(batchId);
    if (
      batch.status === CalendarImportStatus.REJECTED ||
      batch.status === CalendarImportStatus.PUBLISHED
    ) {
      throw new ConflictException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_EDITABLE,
        message: `Cannot validate batch in status ${batch.status}`,
      });
    }

    const existingEvents = await this.prisma.businessCalendarEvent.findMany({
      where: { calendarVersionId: batch.calendarVersionId },
      select: {
        id: true,
        externalReference: true,
        sourcePayloadHash: true,
      },
    });
    const byExternal = new Map(
      existingEvents
        .filter((e) => e.externalReference)
        .map((e) => [e.externalReference as string, e]),
    );

    let validRows = 0;
    let duplicateRows = 0;
    let changedRows = 0;
    let invalidRows = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const row of batch.rows) {
        const payload = row.normalizedPayload as NormalizedHoliday | null;
        if (!payload || row.status === CalendarImportRowStatus.INVALID) {
          invalidRows += 1;
          await tx.businessCalendarImportRow.update({
            where: { id: row.id },
            data: {
              status: CalendarImportRowStatus.INVALID,
              validationErrors: row.validationErrors ?? ['Invalid row'],
            },
          });
          continue;
        }

        const existing = payload.externalReference
          ? byExternal.get(payload.externalReference)
          : undefined;

        let status: CalendarImportRowStatus = CalendarImportRowStatus.VALID;
        if (existing) {
          if (existing.sourcePayloadHash === row.payloadHash) {
            status = CalendarImportRowStatus.DUPLICATE;
            duplicateRows += 1;
          } else {
            status = CalendarImportRowStatus.CHANGED;
            changedRows += 1;
          }
        } else {
          validRows += 1;
        }

        await tx.businessCalendarImportRow.update({
          where: { id: row.id },
          data: {
            status,
            candidateEventId: existing?.id ?? null,
          },
        });
      }

      await tx.businessCalendarImportBatch.update({
        where: { id: batch.id },
        data: {
          status: CalendarImportStatus.REVIEW_REQUIRED,
          validRows,
          duplicateRows,
          changedRows,
          invalidRows,
          totalRows: batch.rows.length,
        },
      });
    });

    await this.auditService.log(
      'BusinessCalendarImportBatch',
      batch.id,
      'VALIDATE',
      undefined,
      { validRows, duplicateRows, changedRows, invalidRows },
      { userId: actorUserId },
    );

    return this.getBatch(batchId);
  }

  async review(
    batchId: string,
    dto: ReviewImportBatchDto,
    actorUserId: string,
  ) {
    const batch = await this.getBatch(batchId);
    if (
      batch.status !== CalendarImportStatus.REVIEW_REQUIRED &&
      batch.status !== CalendarImportStatus.VALIDATED &&
      batch.status !== CalendarImportStatus.APPROVED
    ) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_IMPORT_REVIEW_REQUIRED,
        message: 'Batch must be validated before review',
      });
    }

    const selected = new Set(dto.selectedRowIds);
    await this.prisma.$transaction(async (tx) => {
      for (const row of batch.rows) {
        const next =
          selected.has(row.id) &&
          (row.status === CalendarImportRowStatus.VALID ||
            row.status === CalendarImportRowStatus.CHANGED ||
            row.status === CalendarImportRowStatus.SELECTED)
            ? CalendarImportRowStatus.SELECTED
            : CalendarImportRowStatus.SKIPPED;
        await tx.businessCalendarImportRow.update({
          where: { id: row.id },
          data: { status: next },
        });
      }

      await tx.businessCalendarImportBatch.update({
        where: { id: batch.id },
        data: {
          status:
            dto.approve === false
              ? CalendarImportStatus.REVIEW_REQUIRED
              : CalendarImportStatus.APPROVED,
          reviewedByUserId: actorUserId,
          reviewedAt: new Date(),
        },
      });
    });

    await this.auditService.log(
      'BusinessCalendarImportBatch',
      batch.id,
      'REVIEW',
      undefined,
      {
        selectedCount: dto.selectedRowIds.length,
        approve: dto.approve !== false,
      },
      { userId: actorUserId },
    );

    return this.getBatch(batchId);
  }

  async reject(batchId: string, actorUserId: string) {
    const batch = await this.getBatch(batchId);
    if (batch.status === CalendarImportStatus.PUBLISHED) {
      throw new ConflictException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_EDITABLE,
        message: 'Applied import cannot be rejected',
      });
    }

    await this.prisma.businessCalendarImportBatch.update({
      where: { id: batch.id },
      data: {
        status: CalendarImportStatus.REJECTED,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
    });

    await this.auditService.log(
      'BusinessCalendarImportBatch',
      batch.id,
      'REJECT',
      undefined,
      {},
      { userId: actorUserId },
    );

    return this.getBatch(batchId);
  }

  async applyToDraft(batchId: string, actorUserId: string) {
    const batch = await this.getBatch(batchId);
    if (batch.status !== CalendarImportStatus.APPROVED) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_IMPORT_REVIEW_REQUIRED,
        message: 'Import must be reviewed and approved before apply',
      });
    }

    const version = await this.requireDraftVersion(batch.calendarVersionId);
    const selected = batch.rows.filter(
      (row) => row.status === CalendarImportRowStatus.SELECTED,
    );
    if (selected.length === 0) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'No selected rows to apply',
      });
    }

    const typeCache = new Map<string, string>();
    const categoryCache = new Map<string, string>();

    const resolveTypeId = async (code: string) => {
      if (typeCache.has(code)) return typeCache.get(code)!;
      const id = systemMetadataId('type', code);
      const found = await this.prisma.businessCalendarEventType.findFirst({
        where: {
          OR: [
            { id },
            { eventTypeCode: code, companyId: null },
            { eventTypeCode: code, companyId: version.calendar.companyId },
          ],
          isActive: true,
        },
      });
      if (!found) {
        throw new BadRequestException(`Unknown event type: ${code}`);
      }
      typeCache.set(code, found.id);
      return found.id;
    };

    const resolveCategoryId = async (code: string) => {
      if (categoryCache.has(code)) return categoryCache.get(code)!;
      const id = systemMetadataId('category', code);
      const found = await this.prisma.businessCalendarEventCategory.findFirst({
        where: {
          OR: [
            { id },
            { categoryCode: code, companyId: null },
            { categoryCode: code, companyId: version.calendar.companyId },
          ],
          isActive: true,
        },
      });
      if (!found) {
        throw new BadRequestException(`Unknown event category: ${code}`);
      }
      categoryCache.set(code, found.id);
      return found.id;
    };

    const target =
      version.calendar.scope === BusinessCalendarScope.BRANCH &&
      version.calendar.branchId
        ? {
            targetType: CalendarEventTargetType.BRANCH,
            companyId: version.calendar.companyId,
            branchId: version.calendar.branchId,
          }
        : {
            targetType: CalendarEventTargetType.COMPANY,
            companyId: version.calendar.companyId,
            branchId: null as string | null,
          };

    await this.prisma.$transaction(async (tx) => {
      for (const row of selected) {
        const payload = row.normalizedPayload as unknown as NormalizedHoliday;
        const eventTypeId = await resolveTypeId(payload.eventTypeCode);
        const eventCategoryId = await resolveCategoryId(payload.categoryCode);

        if (row.candidateEventId) {
          await tx.businessCalendarEvent.update({
            where: { id: row.candidateEventId },
            data: {
              eventName: payload.eventName,
              eventCode: payload.eventCode,
              startDate: new Date(`${payload.startDate}T00:00:00.000Z`),
              endDate: new Date(`${payload.endDate}T00:00:00.000Z`),
              allDay: payload.allDay,
              startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
              endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
              eventTimezone: payload.eventTimezone ?? null,
              businessDayEffect: payload.businessDayEffect,
              paidHoliday: payload.paidHoliday,
              externalReference: payload.externalReference,
              sourcePayloadHash: row.payloadHash,
              eventTypeId,
              eventCategoryId,
              eventSourceId: batch.eventSourceId,
            },
          });
          await tx.businessCalendarImportRow.update({
            where: { id: row.id },
            data: { status: CalendarImportRowStatus.PUBLISHED },
          });
          continue;
        }

        const created = await tx.businessCalendarEvent.create({
          data: {
            calendarVersionId: version.id,
            companyId: version.calendar.companyId,
            eventTypeId,
            eventCategoryId,
            eventSourceId: batch.eventSourceId,
            eventCode: payload.eventCode,
            eventName: payload.eventName,
            allDay: payload.allDay,
            startDate: new Date(`${payload.startDate}T00:00:00.000Z`),
            endDate: new Date(`${payload.endDate}T00:00:00.000Z`),
            startsAt: payload.startsAt ? new Date(payload.startsAt) : null,
            endsAt: payload.endsAt ? new Date(payload.endsAt) : null,
            eventTimezone: payload.eventTimezone ?? null,
            businessDayEffect: payload.businessDayEffect,
            paidHoliday: payload.paidHoliday,
            isProtected: false,
            externalReference: payload.externalReference,
            sourcePayloadHash: row.payloadHash,
            createdByUserId: actorUserId,
            targets: {
              create: [
                {
                  targetType: target.targetType,
                  companyId: target.companyId,
                  branchId: target.branchId,
                },
              ],
            },
          },
        });

        await tx.businessCalendarImportRow.update({
          where: { id: row.id },
          data: {
            status: CalendarImportRowStatus.PUBLISHED,
            candidateEventId: created.id,
          },
        });
      }

      await tx.businessCalendarVersion.update({
        where: { id: version.id },
        data: { optimisticVersion: { increment: 1 } },
      });
      await this.versions.refreshChecksum(tx, version.id);

      await tx.businessCalendarImportBatch.update({
        where: { id: batch.id },
        data: { status: CalendarImportStatus.PUBLISHED },
      });
    });

    await this.auditService.log(
      'BusinessCalendarImportBatch',
      batch.id,
      'APPLY_TO_DRAFT',
      undefined,
      { appliedRows: selected.length, versionId: version.id },
      { userId: actorUserId },
    );

    return this.getBatch(batchId);
  }

  private async persistBatch(input: {
    version: Awaited<
      ReturnType<BusinessCalendarImportService['requireDraftVersion']>
    >;
    sourceId: string;
    sourceKind: CalendarSourceKind;
    sourceFileName: string;
    sourceChecksum: string;
    actorUserId: string;
    parsed: ParsedImportRow[];
  }) {
    const counts = {
      totalRows: input.parsed.length,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      changedRows: 0,
    };

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.businessCalendarImportBatch.create({
        data: {
          companyId: input.version.calendar.companyId,
          calendarId: input.version.calendarId,
          calendarVersionId: input.version.id,
          eventSourceId: input.sourceId,
          sourceKind: input.sourceKind,
          sourceFileName: input.sourceFileName,
          sourceChecksum: input.sourceChecksum,
          status: CalendarImportStatus.UPLOADED,
          uploadedByUserId: input.actorUserId,
          totalRows: input.parsed.length,
        },
      });

      for (const row of input.parsed) {
        const isInvalid = row.errors.length > 0 || !row.normalized;
        if (isInvalid) counts.invalidRows += 1;
        else counts.validRows += 1;

        await tx.businessCalendarImportRow.create({
          data: {
            importBatchId: created.id,
            rowNumber: row.rowNumber,
            externalReference: row.normalized?.externalReference ?? null,
            normalizedPayload: row.normalized ?? row.raw,
            payloadHash: row.normalized
              ? payloadHash(row.normalized)
              : checksumBuffer(Buffer.from(JSON.stringify(row.raw))),
            status: isInvalid
              ? CalendarImportRowStatus.INVALID
              : CalendarImportRowStatus.VALID,
            validationErrors: row.errors.length
              ? (row.errors as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          },
        });
      }

      return tx.businessCalendarImportBatch.update({
        where: { id: created.id },
        data: {
          validRows: counts.validRows,
          invalidRows: counts.invalidRows,
        },
        include: { rows: true, eventSource: true },
      });
    });

    await this.auditService.log(
      'BusinessCalendarImportBatch',
      batch.id,
      'UPLOAD',
      undefined,
      {
        sourceKind: input.sourceKind,
        sourceChecksum: input.sourceChecksum,
        ...counts,
      },
      { userId: input.actorUserId },
    );

    return batch;
  }

  private async requireDraftVersion(versionId: string) {
    const version = await this.versions.requireVersion(versionId);
    this.versions.assertDraftEditable(version);
    await this.employeeDomainScope.assertCompanyInScope(
      version.calendar.companyId,
    );
    return version;
  }

  private async resolveFallbackGeography(input: {
    calendarId: string;
    calendar: { companyId: string };
  }): Promise<ImportGeographyFallback | undefined> {
    const calendar = await this.prisma.businessCalendar.findFirst({
      where: {
        id: input.calendarId,
        companyId: input.calendar.companyId,
      },
      select: {
        company: { select: { legalCountryCode: true } },
        branch: {
          select: {
            countryCode: true,
            countrySubdivisionCode: true,
          },
        },
      },
    });

    const countryCode =
      calendar?.branch?.countryCode?.trim() ||
      calendar?.company.legalCountryCode?.trim();
    if (!countryCode) return undefined;

    return {
      countryCode,
      subdivisionCode: calendar?.branch?.countrySubdivisionCode?.trim() || null,
    };
  }

  private async requireSource(kind: CalendarSourceKind) {
    const source = await this.prisma.businessCalendarEventSource.findFirst({
      where: {
        sourceKind: kind,
        isActive: true,
        companyId: null,
      },
      orderBy: { displayOrder: 'asc' },
    });
    if (!source) {
      throw new BadRequestException(`Event source not configured for ${kind}`);
    }
    return source;
  }
}
