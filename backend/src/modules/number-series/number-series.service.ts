import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';

export type NumberSeriesEntity =
  | 'COMPANY_GROUP'
  | 'COMPANY'
  | 'BRANCH'
  | 'DEPARTMENT'
  | 'DESIGNATION'
  | 'SHIFT'
  | 'EMPLOYEE'
  | 'ASSET_CATEGORY'
  | 'ASSET_TYPE'
  | 'ASSET'
  | 'ROLE'
  | 'JOB_OPENING'
  | 'JOB_APPLICATION'
  | 'BUSINESS_PARTY'
  | 'FINANCE_TRANSACTION'
  | 'PAYROLL_RUN'
  | 'PROJECT';

interface NumberSeriesValue {
  currentValue: number;
}

@Injectable()
export class NumberSeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async next(
    entityType: NumberSeriesEntity,
    scopeKey: string,
    prefix: string,
    digits = 6,
    client?: Prisma.TransactionClient,
  ): Promise<string> {
    const normalizedScope = scopeKey.trim() || 'GLOBAL';
    const normalizedPrefix = prefix.trim().toUpperCase();
    const db = client ?? this.prisma;

    if (entityType === 'EMPLOYEE' && normalizedScope === 'GLOBAL') {
      await this.alignEmployeeGlobalSeries(db, normalizedPrefix);
    }

    const rows = await db.$queryRaw<NumberSeriesValue[]>(Prisma.sql`
      INSERT INTO "number_series" (
        "id",
        "entityType",
        "scopeKey",
        "prefix",
        "currentValue",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        ${randomUUID()},
        ${entityType},
        ${normalizedScope},
        ${normalizedPrefix},
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("entityType", "scopeKey")
      DO UPDATE SET
        "currentValue" = "number_series"."currentValue" + 1,
        "prefix" = EXCLUDED."prefix",
        "updatedAt" = CURRENT_TIMESTAMP
      RETURNING "currentValue"
    `);

    const value = rows[0]?.currentValue;

    if (!Number.isInteger(value) || value < 1) {
      throw new Error('Number series did not return a valid value.');
    }

    return `${normalizedPrefix}-${value.toString().padStart(digits, '0')}`;
  }

  /**
   * Keep GLOBAL EMP series ahead of existing employee codes on shared DBs.
   */
  private async alignEmployeeGlobalSeries(
    db: Prisma.TransactionClient | PrismaService,
    prefix: string,
  ): Promise<void> {
    const codeStripPattern = `^${prefix}-`;
    const codeMatchPattern = `^${prefix}-[0-9]+$`;
    await db.$executeRaw(Prisma.sql`
      WITH max_emp AS (
        SELECT COALESCE(
          MAX(
            NULLIF(
              regexp_replace("employeeCode", ${codeStripPattern}, ''),
              ''
            )::int
          ),
          0
        ) AS max_value
        FROM "employees"
        WHERE "employeeCode" ~ ${codeMatchPattern}
      )
      INSERT INTO "number_series" (
        "id",
        "entityType",
        "scopeKey",
        "prefix",
        "currentValue",
        "createdAt",
        "updatedAt"
      )
      SELECT
        ${randomUUID()},
        'EMPLOYEE',
        'GLOBAL',
        ${prefix},
        max_emp.max_value,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      FROM max_emp
      ON CONFLICT ("entityType", "scopeKey")
      DO UPDATE SET
        "currentValue" = GREATEST(
          "number_series"."currentValue",
          EXCLUDED."currentValue"
        ),
        "prefix" = EXCLUDED."prefix",
        "updatedAt" = CURRENT_TIMESTAMP
    `);
  }
}
