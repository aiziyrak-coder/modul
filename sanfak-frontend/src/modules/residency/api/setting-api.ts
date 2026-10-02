import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOne, putJson } from '@/shared/api';

const ROOT = '/residency-settings';
const KEY = 'residency-settings';

interface BackendResidencySetting {
  _id?: string;
  workDayFrom?: string;
  workDayTo?: string;
  absenceStreakDays?: number;
  absenceWindowDays?: number;
}

export interface ResidencySetting {
  workDayFrom: string;
  workDayTo: string;
  absenceStreakDays: number;
  absenceWindowDays: number | null;
}

export interface ResidencySettingInput {
  workDayFrom?: string;
  workDayTo?: string;
  absenceStreakDays?: number;
  absenceWindowDays?: number;
}

export const SETTING_FALLBACK: ResidencySetting & { absenceWindowDays: number } = {
  workDayFrom: '09:00',
  workDayTo: '14:00',
  absenceStreakDays: 3,
  absenceWindowDays: 7,
};

export const mapSetting = (b: BackendResidencySetting): ResidencySetting => ({
  workDayFrom: b.workDayFrom ?? SETTING_FALLBACK.workDayFrom,
  workDayTo: b.workDayTo ?? SETTING_FALLBACK.workDayTo,
  absenceStreakDays: b.absenceStreakDays ?? SETTING_FALLBACK.absenceStreakDays,
  absenceWindowDays: typeof b.absenceWindowDays === 'number' ? b.absenceWindowDays : null,
});

export function useResidencySettings(enabled = true) {
  return useQuery({
    queryKey: [KEY],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ResidencySetting> =>
      mapSetting(await fetchOne<BackendResidencySetting>(ROOT)),
  });
}

export function useUpdateResidencySettings() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (data: ResidencySettingInput) => putJson(ROOT, data),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}
