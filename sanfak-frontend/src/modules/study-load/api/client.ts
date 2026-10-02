export {
  apiClient,
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
  type ListParams,
} from '@/shared/api';

export const ENDPOINTS = {
  studyPlans: '/study-plans',
  workingPlans: '/working-plans',
  workloads: '/workloads',
  distributions: '/distributions',
  sciencePrograms: '/science-programs',
  syllabi: '/syllabi',
} as const;
