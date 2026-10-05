import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { OutboxModule } from '../outbox/outbox.module';

import { BusinessPartyController } from './controllers/business-party.controller';
import { OfficeFinanceCategoriesController } from './controllers/office-finance-categories.controller';
import {
  OfficeFinanceDashboardController,
  OfficeFinanceReportsController,
} from './controllers/office-finance-reports.controller';
import { OfficeFinancePaymentAccountsController } from './controllers/office-finance-payment-accounts.controller';
import { OfficeFinancePeriodsController } from './controllers/office-finance-periods.controller';
import { OfficeFinanceSettingsController } from './controllers/office-finance-settings.controller';
import { OfficeFinanceTransactionsController } from './controllers/office-finance-transactions.controller';
import { OfficeFinanceFeatureGuard } from './guards/office-finance-feature.guard';
import { BusinessPartyService } from './services/business-party.service';
import { FinanceBankReferenceEncryptionService } from './services/finance-bank-reference-encryption.service';
import { FinanceCapabilityService } from './services/finance-capability.service';
import { FinanceCommandReceiptService } from './services/finance-command-receipt.service';
import { OfficeFinanceDeliveryService } from './services/office-finance-delivery.service';
import { FinanceResponseMapper } from './services/finance-response.mapper';
import { FinanceTransactionValidatorService } from './services/finance-transaction-validator.service';
import { OfficeFinanceAttachmentsService } from './services/office-finance-attachments.service';
import { OfficeFinanceCategoriesService } from './services/office-finance-categories.service';
import { OfficeFinanceFeatureService } from './services/office-finance-feature.service';
import { OfficeFinancePaymentAccountsService } from './services/office-finance-payment-accounts.service';
import { OfficeFinancePeriodsService } from './services/office-finance-periods.service';
import { OfficeFinanceReportsService } from './services/office-finance-reports.service';
import { OfficeFinanceScopeService } from './services/office-finance-scope.service';
import { OfficeFinanceSettingsService } from './services/office-finance-settings.service';
import { OfficeFinanceTransactionsService } from './services/office-finance-transactions.service';
import { PayrollExpenseService } from './services/payroll-expense.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => FileStorageModule),
    forwardRef(() => OutboxModule),
  ],
  controllers: [
    OfficeFinanceSettingsController,
    BusinessPartyController,
    OfficeFinanceCategoriesController,
    OfficeFinancePaymentAccountsController,
    OfficeFinancePeriodsController,
    OfficeFinanceTransactionsController,
    OfficeFinanceDashboardController,
    OfficeFinanceReportsController,
  ],
  providers: [
    OfficeFinanceFeatureService,
    OfficeFinanceFeatureGuard,
    OfficeFinanceScopeService,
    FinanceCommandReceiptService,
    OfficeFinanceDeliveryService,
    FinanceBankReferenceEncryptionService,
    FinanceCapabilityService,
    FinanceTransactionValidatorService,
    FinanceResponseMapper,
    OfficeFinanceSettingsService,
    BusinessPartyService,
    OfficeFinanceCategoriesService,
    OfficeFinancePaymentAccountsService,
    OfficeFinancePeriodsService,
    OfficeFinanceTransactionsService,
    OfficeFinanceAttachmentsService,
    OfficeFinanceReportsService,
    PayrollExpenseService,
  ],
  exports: [
    PayrollExpenseService,
    OfficeFinanceFeatureService,
    OfficeFinanceReportsService,
  ],
})
export class OfficeFinanceModule {}
