export type ValidationSeverity =
  | "error"
  | "warning"
  | "info";

export type ValidationTarget =
  | "template"
  | "department"
  | "group"
  | "task";

export interface ValidationIssue {

  id: string;

  severity: ValidationSeverity;

  target: ValidationTarget;

  targetId: string;

  title: string;

  message: string;

}

export interface ValidationResult {

  valid: boolean;

  issues: ValidationIssue[];

}