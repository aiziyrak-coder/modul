export { queryClient } from './query-client';
export { apiClient, refreshAccessToken } from './client';
export {
  startTokenRefreshScheduler,
  stopTokenRefreshScheduler,
} from './token-refresh-scheduler';
export {
  fetchOne,
  fetchList,
  fetchPaginated,
  postJson,
  putJson,
  patchJson,
  deleteData,
  uploadMultipart,
  getApiErrorMessage,
  type Paginated,
} from './http';
export {
  getAccessToken,
  setAccessToken,
  hasAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens,
  setUnauthorizedHandler,
  notifyUnauthorized,
} from './token-store';

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: unknown;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
}
