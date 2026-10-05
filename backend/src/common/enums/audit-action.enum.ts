/**
 * Audit log actions.
 * Can be extended as additional ERP modules are introduced.
 */
export enum AuditAction {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',

  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',

  APPROVE = 'APPROVE',
  REJECT = 'REJECT',

  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',

  PRINT = 'PRINT',
  DOWNLOAD = 'DOWNLOAD',
}
