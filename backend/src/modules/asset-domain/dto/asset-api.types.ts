/** Standard Asset list envelope (plan §6.3). */
export interface PaginatedResponse<TItem> {
  items: TItem[];
  total: number;
  page: number;
  limit: number;
}

/** Optional stale-version detail on conflict responses (plan §6.4). */
export interface AssetStaleVersionDetail {
  field: string;
  code: 'STALE_VERSION';
  currentVersion: number;
}

export const ASSET_IDEMPOTENT_REPLAY_HEADER = 'X-Idempotent-Replay';

/** Monetary amounts are decimal strings in API responses (plan §6.2). */
export type AssetMoneyString = string;

/** Calendar business dates use YYYY-MM-DD in DTOs (plan §6.2). */
export type AssetCalendarDateString = string;
