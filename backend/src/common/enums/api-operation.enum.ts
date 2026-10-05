/**
 * Generic API operations.
 * Primarily used by interceptors, decorators and Swagger helpers.
 */
export enum ApiOperation {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',

  GET = 'GET',
  LIST = 'LIST',
  SUMMARY = 'SUMMARY',
}
