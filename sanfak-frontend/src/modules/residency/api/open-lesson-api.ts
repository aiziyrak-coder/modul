import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchList, postJson, putJson, deleteData } from '@/shared/api';
import type {
  OpenLesson,
  OpenLessonAttendee,
  OpenLessonInput,
  OpenLessonPlanKind,
  OpenLessonType,
} from './open-lesson-types';
import { nameOrSnapshot, titleOrSnapshot } from './ref-title';
import { nameOf as userName } from './user-name';

interface RawRef {
  _id: string;
  title?: string;
}
interface RawAttendee {
  user?: string | { _id: string; firstName?: string; lastName?: string; middleName?: string } | null;
  name?: string | null;
}
interface BackendOpenLesson {
  _id: string;
  resident?: string | { _id: string; fullName?: string } | null;
  residentName?: string | null;
  type: string;
  date: string;
  room?: string | RawRef | null;
  roomTitle?: string | null;
  topic?: string | null;
  attendees?: RawAttendee[] | null;
  plan?: string | null;
  planKind?: string | null;
  planTitle?: string | null;
  taskTitle?: string | null;
  note?: string | null;
  academicYear?: string | null;
  createdAt?: string | null;
}

const refId = (v: string | RawRef | { _id: string } | null | undefined): string | null =>
  v && typeof v === 'object' ? v._id : (v ?? null);

const asType = (t: string): OpenLessonType =>
  t === 'dars_kuzatish' ? 'dars_kuzatish' : 'ochiq_dars';

const asPlanKind = (k: string | null | undefined): OpenLessonPlanKind | null =>
  k === 'activity' || k === 'dissertation' ? k : null;

const residentFullName = (
  r: string | { _id: string; fullName?: string } | null | undefined,
): string | null => (r && typeof r === 'object' ? (r.fullName ?? null) : null);

export const mapAttendee = (a: RawAttendee): OpenLessonAttendee => ({
  userId: refId(a.user) ?? '',
  name: nameOrSnapshot(userName(a.user), a.name),
});

export const mapOpenLesson = (b: BackendOpenLesson): OpenLesson => ({
  id: b._id,
  residentId: refId(b.resident) ?? '',
  residentName: nameOrSnapshot(residentFullName(b.resident), b.residentName),
  type: asType(b.type),
  date: b.date,
  roomId: refId(b.room),
  roomTitle: titleOrSnapshot(b.room, b.roomTitle),
  topic: b.topic ?? null,
  attendees: (b.attendees ?? []).map(mapAttendee),
  planId: b.plan ?? null,
  planKind: asPlanKind(b.planKind),
  planTitle: b.planTitle ?? null,
  taskTitle: b.taskTitle ?? null,
  note: b.note ?? null,
  academicYear: b.academicYear ?? null,
  createdAt: b.createdAt ?? null,
});

const ROOT = '/open-lessons';
const KEY = 'residency-open-lessons';

export function useResidentOpenLessons(residentId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'resident', residentId],
    enabled: !!residentId && enabled,
    queryFn: async (): Promise<OpenLesson[]> =>
      (await fetchList<BackendOpenLesson>(`${ROOT}/resident/${residentId}`)).map(
        mapOpenLesson,
      ),
  });
}

export function useCreateOpenLesson() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (input: OpenLessonInput) => postJson(ROOT, input),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateOpenLesson() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Omit<Partial<OpenLessonInput>, 'resident'> }) =>
      putJson(`${ROOT}/${id}`, data),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteOpenLesson() {
  const q = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteData(`${ROOT}/${id}`),
    onSuccess: () => q.invalidateQueries({ queryKey: [KEY] }),
  });
}
