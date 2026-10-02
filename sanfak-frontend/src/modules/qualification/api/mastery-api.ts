import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchOne } from '@/shared/api';

const KEY = 'qual-mastery';
const ROOT = '/qualification-topic-completions';

export interface MasteryTopic {
  id: string;
  title: string;
  orderNumber: number;
  duration: number;
}

export interface MasteryRow {
  listenerId: string;
  listenerName: string;
  passedTopicIds: string[];
  percent: number;
}

export interface MasteryGrid {
  topics: MasteryTopic[];
  rows: MasteryRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

interface BackendMasteryGrid {
  topics: Array<{ _id: string; title: string; orderNumber: number; duration: number }>;
  docs: Array<{
    listener: string;
    listenerName: string;
    passedTopicIds?: string[];
    percent: number;
  }>;
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
}

function mapMasteryGrid(b: BackendMasteryGrid): MasteryGrid {
  return {
    topics: b.topics.map((tp) => ({
      id: tp._id,
      title: tp.title,
      orderNumber: tp.orderNumber,
      duration: tp.duration,
    })),
    rows: b.docs.map((d) => ({
      listenerId: d.listener,
      listenerName: d.listenerName,
      passedTopicIds: d.passedTopicIds ?? [],
      percent: d.percent,
    })),
    meta: { page: b.page, limit: b.limit, total: b.totalDocs, totalPages: b.totalPages },
  };
}

export function useMasteryGrid(course: string | undefined, page: number, limit: number) {
  return useQuery({
    staleTime: 0,
    placeholderData: keepPreviousData,
    queryKey: [KEY, 'grid', course, page, limit],
    queryFn: async (): Promise<MasteryGrid> =>
      mapMasteryGrid(
        await fetchOne<BackendMasteryGrid>(
          `${ROOT}/mastery-grid?course=${course}&page=${page}&limit=${limit}`,
        ),
      ),
    enabled: !!course,
  });
}

export async function fetchMasteryGridAll(course: string): Promise<MasteryGrid> {
  return mapMasteryGrid(
    await fetchOne<BackendMasteryGrid>(
      `${ROOT}/mastery-grid?course=${course}&page=1&limit=100000`,
    ),
  );
}
