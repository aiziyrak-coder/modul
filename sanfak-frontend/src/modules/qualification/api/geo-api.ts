import { useQuery } from '@tanstack/react-query';
import { fetchList } from '@/shared/api';
import type { Option } from '../model/course.types';

const PROVINCES = '/provinces';
const REGIONS = '/regions';

interface BackendGeo {
  _id: string;
  title: string;
}

export function useProvinces() {
  return useQuery({
    staleTime: 0,
    queryKey: ['qual-province', 'options'],
    queryFn: async (): Promise<Option[]> => {
      const docs = await fetchList<BackendGeo>(PROVINCES, { active: true });
      return docs.map((d) => ({ value: d._id, label: d.title }));
    },
  });
}

export function useRegions(province: string | undefined) {
  return useQuery({
    staleTime: 0,
    queryKey: ['qual-region', 'options', province],
    queryFn: async (): Promise<Option[]> => {
      const docs = await fetchList<BackendGeo>(REGIONS, { province, active: true });
      return docs.map((d) => ({ value: d._id, label: d.title }));
    },
    enabled: !!province,
  });
}
