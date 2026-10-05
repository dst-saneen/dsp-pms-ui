import { Logger } from '@nestjs/common';

type ModuleName = 'finance' | 'payroll';

class ErpOpsMetrics {
  private readonly logger = new Logger('ErpOpsMetrics');
  versionConflicts = 0;
  operationIdConflicts = 0;
  serializationRetries = 0;
  selfApprovalRejections = 0;
  reversalFailures = 0;
  preflightBlockers = 0;
  payslipDeadLetters = 0;

  record(
    event: string,
    moduleName: ModuleName,
    extra?: Record<string, string>,
  ) {
    if (event === 'version_conflict') this.versionConflicts += 1;
    if (event === 'operation_id_conflict') this.operationIdConflicts += 1;
    if (event === 'serialization_retry') this.serializationRetries += 1;
    if (event === 'self_approval') this.selfApprovalRejections += 1;
    if (event === 'reversal_failure') this.reversalFailures += 1;
    if (event === 'preflight_blocked') this.preflightBlockers += 1;
    if (event === 'payslip_dead_letter') this.payslipDeadLetters += 1;

    this.logger.log(
      `module=${moduleName} event=${event} ${Object.entries(extra ?? {})
        .map(([key, value]) => `${key}=${value}`)
        .join(' ')}`.trim(),
    );
  }
}

export const erpOpsMetrics = new ErpOpsMetrics();
