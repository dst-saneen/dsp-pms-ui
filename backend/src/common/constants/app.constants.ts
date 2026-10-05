/**
 * ERP Platform Constants
 *
 * Central location for application-wide constants.
 * These values should be used throughout the platform
 * instead of hard-coded literals.
 */

export const AppConstants = {
  Pagination: {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100,
  },

  Sorting: {
    DEFAULT_SORT_BY: 'createdAt',
    DEFAULT_SORT_ORDER: 'desc' as const,
  },

  Audit: {
    SYSTEM_USER: 'SYSTEM',
    CREATED_BY: 'createdBy',
    UPDATED_BY: 'updatedBy',
    CREATED_AT: 'createdAt',
    UPDATED_AT: 'updatedAt',
  },

  Status: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    DRAFT: 'DRAFT',
    ARCHIVED: 'ARCHIVED',
  },

  Search: {
    DEFAULT_KEYWORD: '',
    DEFAULT_INCLUDE_INACTIVE: false,
  },

  Validation: {
    MAX_NAME_LENGTH: 255,
    MAX_DESCRIPTION_LENGTH: 1000,
  },
} as const;
