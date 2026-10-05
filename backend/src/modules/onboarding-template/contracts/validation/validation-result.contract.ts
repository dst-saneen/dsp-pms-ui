import { ValidationMessageContract } from './validation-message.contract';

export interface ValidationResultContract {
  valid: boolean;

  errorCount: number;

  warningCount: number;

  errors: ValidationMessageContract[];

  warnings: ValidationMessageContract[];
}
