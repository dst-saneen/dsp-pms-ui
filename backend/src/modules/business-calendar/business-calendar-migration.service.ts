import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  runBusinessCalendarBackfill,
  type BackfillExpectedCounts,
  type BackfillReport,
} from './business-calendar-backfill.runner';
import {
  runBusinessCalendarShadowCompare,
  type ShadowParityReport,
} from './business-calendar-shadow.runner';

@Injectable()
export class BusinessCalendarMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async backfill(input: {
    apply: boolean;
    expected: BackfillExpectedCounts;
    effectiveYear: number;
    actorUserId: string;
    companyId?: string;
    allowProduction?: boolean;
  }): Promise<BackfillReport> {
    const dbInfo = await this.prisma.$queryRawUnsafe<Array<{ db: string }>>(
      'SELECT current_database() AS db',
    );
    return runBusinessCalendarBackfill(this.prisma, {
      apply: input.apply,
      expected: input.expected,
      effectiveYear: input.effectiveYear,
      actorUserId: input.actorUserId,
      companyId: input.companyId,
      allowProduction: input.allowProduction === true,
      databaseName: dbInfo[0]?.db ?? 'unknown',
      databaseSchema: this.config.getOrThrow('DATABASE_SCHEMA', {
        infer: true,
      }),
    });
  }

  async shadowCompare(input: {
    companyId: string;
    branchId: string;
    actorUserId: string;
    activateShadow?: boolean;
    allowDraftVersions?: boolean;
    allowProduction?: boolean;
    reportPath?: string;
  }): Promise<ShadowParityReport> {
    const dbInfo = await this.prisma.$queryRawUnsafe<Array<{ db: string }>>(
      'SELECT current_database() AS db',
    );
    return runBusinessCalendarShadowCompare(this.prisma, {
      companyId: input.companyId,
      branchId: input.branchId,
      actorUserId: input.actorUserId,
      activateShadow: input.activateShadow === true,
      allowDraftVersions: input.allowDraftVersions !== false,
      allowProduction: input.allowProduction === true,
      databaseName: dbInfo[0]?.db ?? 'unknown',
      databaseSchema: this.config.getOrThrow('DATABASE_SCHEMA', {
        infer: true,
      }),
      reportPath: input.reportPath,
    });
  }
}
