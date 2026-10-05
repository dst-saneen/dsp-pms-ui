/**
 * Standard CRUD actions.
 * Used by services, repositories and auditing.
 */
export enum CrudAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
  GET = 'GET',
  LIST = 'LIST',
}
