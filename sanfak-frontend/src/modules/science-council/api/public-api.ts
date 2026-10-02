import axios from 'axios';
import { useMutation, useQuery } from '@tanstack/react-query';
import { appConfig } from '@/shared/config';

const publicClient = axios.create({ baseURL: appConfig.apiUrl });

const ROOT = '/public/science-council';

interface BackendPublicSpecialty {
  _id: string;
  title: string;
  code: string;
  branch: string | null;
}

interface BackendPublicTemplate {
  _id: string;
  fileName: string;
  filePath: string;
  size: number | null;
  unit: string | null;
  updatedAt: string | null;
}

export interface BackendFormRefs {
  specialties: BackendPublicSpecialty[];
  academicTitles: string[];
  academicLevels: string[];
  years: string[];
  template: BackendPublicTemplate | null;
}

export interface PublicSpecialty {
  id: string;
  title: string;
  code: string;
  branch: string | null;
}

export interface PublicTemplate {
  fileName: string;
  fileUrl: string;
  size: number | null;
  unit: string | null;
}

export interface PublicFormRefs {
  specialties: PublicSpecialty[];
  academicTitles: string[];
  academicLevels: string[];
  years: string[];
  template: PublicTemplate | null;
}

export function mapPublicFormRefs(d: BackendFormRefs): PublicFormRefs {
  return {
    specialties: (d.specialties ?? []).map((s) => ({
      id: s._id,
      title: s.title,
      code: s.code,
      branch: s.branch ?? null,
    })),
    academicTitles: d.academicTitles ?? [],
    academicLevels: d.academicLevels ?? [],
    years: d.years ?? [],
    template: d.template
      ? {
          fileName: d.template.fileName,
          fileUrl: d.template.filePath,
          size: d.template.size ?? null,
          unit: d.template.unit ?? null,
        }
      : null,
  };
}

export function usePublicFormRefs() {
  return useQuery<PublicFormRefs>({
    queryKey: ['science-council', 'public', 'form-refs'],
    queryFn: async () => {
      const res = await publicClient.get<{ data: BackendFormRefs }>(`${ROOT}/form-refs`);
      return mapPublicFormRefs(res.data.data);
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export interface PublicApplicationInput {
  title: string;
  specialty: string;
  year: string;
  fullName: string;
  workplace: string;
  position: string;
  passportSeries: string;
  passportNumber: string;
  pinfl: string;
  phone: string;
  email: string;
  supervisorName: string;
  supervisorWorkplace: string;
  supervisorPosition: string;
  supervisorAcademicTitle?: string;
  supervisorDegree?: string;
  supervisorEmail?: string;
  supervisorPhone?: string;
}

export function useSubmitPublicApplication() {
  return useMutation({
    mutationFn: async ({ values, file }: { values: PublicApplicationInput; file: File }) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(values)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          fd.append(k, String(v).trim());
        }
      }
      fd.append('applicationFile', file);
      const res = await publicClient.post<{ message: string; id: string }>(
        `${ROOT}/applications`,
        fd,
      );
      return res.data;
    },
  });
}

export function publicApiMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
  }
  return fallback;
}
