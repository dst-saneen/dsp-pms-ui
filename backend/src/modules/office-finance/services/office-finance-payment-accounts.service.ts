import { Injectable } from '@nestjs/common';
import {
  FinanceAccountType,
  FinanceActionEntityType,
  FinanceTransactionStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NumberSeriesService } from '../../number-series';

import {
  CreateFinancePaymentAccountDto,
  SearchFinancePaymentAccountDto,
  UpdateFinancePaymentAccountDto,
} from '../dto/finance-payment-account.dto';
import { VersionedReasonCommandDto } from '../dto/versioned-command.dto';
import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { FINANCE_PERMISSIONS } from '../policies/finance-permissions';
import { FinanceBankReferenceEncryptionService } from './finance-bank-reference-encryption.service';
import { FinanceCapabilityService } from './finance-capability.service';
import { FinanceCommandReceiptService } from './finance-command-receipt.service';
import { FinanceResponseMapper } from './finance-response.mapper';
import { OfficeFinanceScopeService } from './office-finance-scope.service';
import { OfficeFinanceSettingsService } from './office-finance-settings.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class OfficeFinancePaymentAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficeFinanceScopeService,
    private readonly receipts: FinanceCommandReceiptService,
    private readonly capabilities: FinanceCapabilityService,
    private readonly mapper: FinanceResponseMapper,
    private readonly numberSeries: NumberSeriesService,
    private readonly settings: OfficeFinanceSettingsService,
    private readonly bankEncryption: FinanceBankReferenceEncryptionService,
  ) {}

  async findPage(
    query: SearchFinancePaymentAccountDto,
    context: OfficeFinanceAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const where: Prisma.FinancePaymentAccountWhereInput = {
      ...this.scope.financePaymentAccountWhere(companyId, context),
      ...(query.keyword
        ? {
            OR: [
              { accountName: { contains: query.keyword, mode: 'insensitive' } },
              { accountCode: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 20;

    const [rows, total] = await Promise.all([
      this.prisma.financePaymentAccount.findMany({
        where,
        orderBy: { accountName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.financePaymentAccount.count({ where }),
    ]);

    return this.mapper.toPaginated(
      rows.map((account) =>
        this.mapper.toPaymentAccount(
          account,
          this.capabilities.getTaxonomyAllowedActions(account, context),
        ),
      ),
      total,
      page,
      limit,
    );
  }

  async findOne(id: string, context: OfficeFinanceAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const account = await this.prisma.financePaymentAccount.findFirst({
      where: {
        id,
        ...this.scope.financePaymentAccountWhere(companyId, context),
      },
    });

    if (!account) {
      this.scope.notFound('Payment account');
    }

    return this.mapper.toPaymentAccount(
      account,
      this.capabilities.getTaxonomyAllowedActions(account, context),
    );
  }

  async getBalance(id: string, context: OfficeFinanceAccessContext) {
    const companyId = this.scope.resolveCompanyId(context);
    await this.scope.assertCompanyScope(companyId);

    const account = await this.prisma.financePaymentAccount.findFirst({
      where: {
        id,
        ...this.scope.financeBranchOwnedPaymentAccountWhere(companyId, context),
      },
    });

    if (!account) {
      this.scope.notFound('Payment account');
    }

    const balance = await this.projectBalance(account, context);

    return {
      accountId: account.id,
      projectedBalance: this.scope.decimalToString(balance),
      asOf: new Date().toISOString(),
    };
  }

  create(
    dto: CreateFinancePaymentAccountDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertSettingsManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'CREATE_PAYMENT_ACCOUNT',
      dto,
      async (tx) => {
        await this.scope.assertCompanyScope(companyId);
        const profile = await this.settings.requireProfile(tx, companyId);
        const requestedCurrency = dto.currencyCode?.trim().toUpperCase();
        if (
          requestedCurrency &&
          requestedCurrency !== profile.baseCurrencyCode
        ) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_ACCOUNT_CURRENCY_MISMATCH,
            'Payment account currency must match the Company financial profile currency.',
          );
        }

        this.scope.assertTransactionBranchScope(
          dto.branchId,
          context,
          'Payment account',
        );

        if (dto.branchId) {
          const branch = await tx.branch.findFirst({
            where: { id: dto.branchId, companyId },
            select: { id: true },
          });
          if (!branch) {
            this.scope.notFound('Branch');
          }
        }

        const prefix =
          dto.accountType === FinanceAccountType.CASH ? 'CA' : 'BA';
        const accountCode = await this.numberSeries.next(
          'FINANCE_TRANSACTION',
          `${companyId}:${prefix}`,
          prefix,
          6,
          tx,
        );

        const accountId = randomUUID();
        const bankReferenceInput = dto.bankReferenceWrite ?? dto.bankReference;
        const normalizedBankReference =
          dto.accountType === FinanceAccountType.BANK && bankReferenceInput
            ? this.bankEncryption.normalizeReference(bankReferenceInput)
            : null;
        const bankEnvelope = normalizedBankReference
          ? this.bankEncryption.encrypt(normalizedBankReference, {
              companyId,
              accountId,
            })
          : null;

        const created = await tx.financePaymentAccount.create({
          data: {
            id: accountId,
            companyId,
            branchId: dto.branchId ?? null,
            accountCode,
            accountName: dto.accountName.trim(),
            accountType: dto.accountType,
            currencyCode: profile.baseCurrencyCode,
            openingBalance: this.scope.parseMoney(
              dto.openingBalance,
              'openingBalance',
            ),
            openingDate: this.scope.parseDate(dto.openingDate, 'openingDate'),
            bankName:
              dto.accountType === FinanceAccountType.BANK
                ? dto.bankName?.trim() || null
                : null,
            bankReferenceEncrypted: bankEnvelope?.ciphertext ?? null,
            bankReferenceEncNonce: bankEnvelope?.nonce ?? null,
            bankReferenceEncTag: bankEnvelope?.tag ?? null,
            bankReferenceEncKeyVersion: bankEnvelope?.keyVersion ?? null,
            bankReferenceEncFormatVersion: bankEnvelope?.formatVersion ?? null,
            bankReferenceKeyVersion: bankEnvelope?.keyVersion ?? null,
            bankLastFour: normalizedBankReference
              ? this.bankEncryption.lastFour(normalizedBankReference)
              : null,
            createdByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          created.id,
          'CREATE',
          0,
          created.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('PAYMENT_ACCOUNT', created.id, {
          version: created.version,
        });
      },
      (id) => this.findOne(id, context),
    );
  }

  update(
    id: string,
    dto: UpdateFinancePaymentAccountDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertSettingsManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'UPDATE_PAYMENT_ACCOUNT',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadAccount(tx, id, companyId, context);
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        if (dto.openingBalance !== undefined || dto.openingDate !== undefined) {
          await this.scope.lockPaymentAccountsForUpdate(tx, [id]);

          const movementCount = await tx.financeTransaction.count({
            where: {
              companyId,
              status: {
                in: [
                  FinanceTransactionStatus.APPROVED,
                  FinanceTransactionStatus.REVERSED,
                ],
              },
              OR: [{ sourceAccountId: id }, { destinationAccountId: id }],
            },
          });

          if (movementCount > 0) {
            throw new DomainConflictException(
              FINANCE_ERROR_CODES.FINANCE_OPENING_BALANCE_LOCKED,
              'Opening balance cannot be changed after movements exist.',
            );
          }
        }

        const bankReferenceWrite =
          dto.bankReferenceWrite !== undefined
            ? dto.bankReferenceWrite
            : dto.bankReference;
        const normalizedBankReferenceUpdate =
          bankReferenceWrite === undefined
            ? undefined
            : bankReferenceWrite
              ? this.bankEncryption.normalizeReference(bankReferenceWrite)
              : null;
        const bankEnvelopeUpdate =
          normalizedBankReferenceUpdate === undefined
            ? undefined
            : normalizedBankReferenceUpdate === null
              ? null
              : this.bankEncryption.encrypt(normalizedBankReferenceUpdate, {
                  companyId,
                  accountId: id,
                });

        const updated = await tx.financePaymentAccount.update({
          where: { id },
          data: {
            accountName: dto.accountName?.trim(),
            openingBalance:
              dto.openingBalance === undefined
                ? undefined
                : this.scope.parseMoney(dto.openingBalance, 'openingBalance'),
            openingDate:
              dto.openingDate === undefined
                ? undefined
                : this.scope.parseDate(dto.openingDate, 'openingDate'),
            bankName:
              dto.bankName === undefined
                ? undefined
                : dto.bankName?.trim() || null,
            ...(bankEnvelopeUpdate === undefined
              ? {}
              : bankEnvelopeUpdate === null
                ? {
                    bankReferenceEncrypted: null,
                    bankReferenceEncNonce: null,
                    bankReferenceEncTag: null,
                    bankReferenceEncKeyVersion: null,
                    bankReferenceEncFormatVersion: null,
                    bankReferenceKeyVersion: null,
                    bankLastFour: null,
                  }
                : {
                    bankReferenceEncrypted: bankEnvelopeUpdate.ciphertext,
                    bankReferenceEncNonce: bankEnvelopeUpdate.nonce,
                    bankReferenceEncTag: bankEnvelopeUpdate.tag,
                    bankReferenceEncKeyVersion: bankEnvelopeUpdate.keyVersion,
                    bankReferenceEncFormatVersion:
                      bankEnvelopeUpdate.formatVersion,
                    bankReferenceKeyVersion: bankEnvelopeUpdate.keyVersion,
                    bankLastFour: this.bankEncryption.lastFour(
                      normalizedBankReferenceUpdate!,
                    ),
                  }),
            version: { increment: 1 },
            updatedByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          id,
          'UPDATE',
          current.version,
          updated.version,
          dto.operationId,
          context.userId,
        );

        return this.receipts.commandMeta('PAYMENT_ACCOUNT', id, {
          version: updated.version,
        });
      },
      () => this.findOne(id, context),
      dto.openingBalance !== undefined || dto.openingDate !== undefined
        ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        : undefined,
    );
  }

  archive(
    id: string,
    dto: VersionedReasonCommandDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertSettingsManage(context);
    const companyId = this.scope.resolveCompanyId(context);

    return this.receipts.execute(
      context,
      companyId,
      'ARCHIVE_PAYMENT_ACCOUNT',
      { id, ...dto },
      async (tx) => {
        const current = await this.loadAccount(tx, id, companyId, context);
        this.scope.assertExpectedVersion(current.version, dto.expectedVersion);

        const profile = await tx.companyFinancialProfile.findUnique({
          where: { companyId },
        });
        if (profile?.payrollExpenseCategoryId) {
          const activePayrollRuns = await tx.payrollRun.count({
            where: {
              companyId,
              statusEnum: { in: ['DRAFT', 'CALCULATED', 'APPROVED'] },
            },
          });
          const activeAccounts = await tx.financePaymentAccount.count({
            where: { companyId, isActive: true, archivedAt: null },
          });
          if (activePayrollRuns > 0 && activeAccounts <= 1) {
            throw new DomainConflictException(
              FINANCE_ERROR_CODES.PAYMENT_ACCOUNT_IN_USE,
              'Payment account cannot be archived while required by active Payroll setup.',
            );
          }
        }

        const updated = await tx.financePaymentAccount.update({
          where: { id },
          data: {
            isActive: false,
            archivedAt: new Date(),
            archivedByUserId: context.userId,
            archiveReason: dto.reason,
            version: { increment: 1 },
            updatedByUserId: context.userId,
          },
        });

        await this.recordEvent(
          tx,
          companyId,
          id,
          'ARCHIVE',
          current.version,
          updated.version,
          dto.operationId,
          context.userId,
          dto.reason,
        );

        return this.receipts.commandMeta('PAYMENT_ACCOUNT', id, {
          version: updated.version,
        });
      },
      () => this.findOne(id, context),
    );
  }

  async projectBalance(
    account: {
      id: string;
      companyId: string;
      openingBalance: Prisma.Decimal;
      openingDate: Date;
    },
    context?: OfficeFinanceAccessContext,
  ): Promise<Prisma.Decimal> {
    const transactions = await this.prisma.financeTransaction.findMany({
      where: {
        ...(context
          ? this.scope.financeTransactionWhere(account.companyId, context)
          : { companyId: account.companyId }),
        transactionDate: { gte: account.openingDate },
        status: {
          in: [
            FinanceTransactionStatus.APPROVED,
            FinanceTransactionStatus.REVERSED,
          ],
        },
        OR: [
          { sourceAccountId: account.id },
          { destinationAccountId: account.id },
        ],
      },
      select: {
        transactionType: true,
        amount: true,
        status: true,
        sourceType: true,
        reversalOfTransactionId: true,
        sourceAccountId: true,
        destinationAccountId: true,
      },
    });

    let balance = account.openingBalance;

    for (const tx of transactions) {
      if (tx.sourceAccountId === account.id) {
        const signed = this.scope.signedMovementAmount(tx, 'source');
        if (signed) {
          balance = balance.add(signed);
        }
      }
      if (tx.destinationAccountId === account.id) {
        const signed = this.scope.signedMovementAmount(tx, 'destination');
        if (signed) {
          balance = balance.add(signed);
        }
      }
    }

    return balance;
  }

  private async loadAccount(
    tx: DbClient,
    id: string,
    companyId: string,
    context: OfficeFinanceAccessContext,
  ) {
    const account = await tx.financePaymentAccount.findFirst({
      where: {
        id,
        ...this.scope.financeBranchOwnedPaymentAccountWhere(companyId, context),
      },
    });

    if (!account) {
      this.scope.notFound('Payment account');
    }

    return account;
  }

  private async recordEvent(
    tx: DbClient,
    companyId: string,
    entityId: string,
    action: string,
    versionBefore: number,
    versionAfter: number,
    operationId: string,
    actorUserId: string,
    reason?: string,
  ) {
    await this.scope.recordActionEvent(tx, {
      companyId,
      entityType: FinanceActionEntityType.PAYMENT_ACCOUNT,
      entityId,
      action,
      actorUserId,
      operationId,
      versionBefore,
      versionAfter,
      reason,
    });
  }

  private assertSettingsManage(context: OfficeFinanceAccessContext) {
    if (!context.permissions.includes(FINANCE_PERMISSIONS.SETTINGS_MANAGE)) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'finance.settings.manage is required',
      );
    }
  }
}
