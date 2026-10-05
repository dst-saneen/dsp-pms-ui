export interface ValidationMessageContract {
  code: string;

  path: string;

  message: string;

  versionId?: string;

  departmentTemplateId?: string;

  taskGroupId?: string;

  taskId?: string;

  field?: string;
}
