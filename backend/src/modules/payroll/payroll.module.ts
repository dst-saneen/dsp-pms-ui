import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { NumberSeriesModule } from '../number-series';
import { OfficeFinanceModule } from '../office-finance/office-finance.module';
import { OutboxModule } from '../outbox/outbox.module';
import { FileStorageModule } from '../file-storage/file-storage.module';

import { PayrollEmployeeInputsController } from './controllers/payroll-employee-inputs.controller';
import { PayrollPayslipsController } from './controllers/payroll-payslips.controller';
import { PayrollPayslipOperationsController } from './controllers/payroll-payslip-operations.controller';
import { PayrollRunsController } from './controllers/payroll-runs.controller';
import { PayrollSalaryComponentsController } from './controllers/payroll-salary-components.controller';
import { PayrollFeatureGuard } from './guards/payroll-feature.guard';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { PayrollCapabilityService } from './services/payroll-capability.service';
import { PayrollCommandReceiptService } from './services/payroll-command-receipt.service';
import { PayrollDashboardService } from './services/payroll-dashboard.service';
import { PayrollEmployeeInputsService } from './services/payroll-employee-inputs.service';
import { PayrollFeatureService } from './services/payroll-feature.service';
import { PayrollPayslipWorkerService } from './services/payroll-payslip-worker.service';
import { PayrollPayslipsService } from './services/payroll-payslips.service';
import { PayrollPreflightService } from './services/payroll-preflight.service';
import { PayrollResponseMapper } from './services/payroll-response.mapper';
import { PayrollRunsService } from './services/payroll-runs.service';
import { PayrollSalaryComponentsService } from './services/payroll-salary-components.service';
import { PayrollScopeService } from './services/payroll-scope.service';

@Module({
  imports: [
    PrismaModule,
    NumberSeriesModule,
    forwardRef(() => OfficeFinanceModule),
    forwardRef(() => OutboxModule),
    forwardRef(() => FileStorageModule),
  ],
  controllers: [
    PayrollSalaryComponentsController,
    PayrollEmployeeInputsController,
    PayrollRunsController,
    PayrollPayslipsController,
    PayrollPayslipOperationsController,
  ],
  providers: [
    PayrollFeatureService,
    PayrollFeatureGuard,
    PayrollScopeService,
    PayrollCommandReceiptService,
    PayrollCapabilityService,
    PayrollResponseMapper,
    PayrollPreflightService,
    PayrollCalculationService,
    PayrollSalaryComponentsService,
    PayrollEmployeeInputsService,
    PayrollRunsService,
    PayrollDashboardService,
    PayrollPayslipsService,
    PayrollPayslipWorkerService,
  ],
  exports: [
    PayrollFeatureService,
    PayrollPayslipsService,
    PayrollPayslipWorkerService,
  ],
})
export class PayrollModule {}
