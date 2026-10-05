/**
 * Common entity status values.
 *
 * This enum is intended for framework usage only.
 * Business modules may define their own domain-specific statuses.
 */
export enum EntityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DRAFT = 'DRAFT',
  ARCHIVED = 'ARCHIVED',
}
