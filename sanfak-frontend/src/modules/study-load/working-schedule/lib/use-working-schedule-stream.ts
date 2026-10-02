import { useEffect, useRef, useState } from 'react';
import { appConfig } from '@/shared/config';
import { getAccessToken } from '@/shared/api/token-store';
import { refreshAccessToken } from '@/shared/api/client';

export type StreamCourseStatus = 'pending' | 'in_progress' | 'created' | 'skipped';

export interface StreamCourse {
  courseNum: number;
  status: StreamCourseStatus;
  replaced?: number;
  lockedReplaced?: number;
  message?: string;
}

export interface StreamCreatedCourse {
  courseNum: number;
  replaced?: number;
  lockedReplaced?: number;
}

export interface StreamSkippedCourse {
  courseNum: number;
  reason?: string;
}

export interface WorkingScheduleDoneData {
  success: boolean;
  totalCreated: number;
  totalReplaced: number;
  totalLockedReplaced: number;
  totalSkipped: number;
  statusUpdated: boolean;
  message: string;
  learningProcessStatus: 'created' | 'new';
  created: StreamCreatedCourse[];
  skipped: StreamSkippedCourse[];
}

interface UseWorkingScheduleStreamProps {
  learningProcessId: string;
  approval?: string;
  courses?: number[];
  autoStart?: boolean;
  onDone?: (data: WorkingScheduleDoneData) => void;
  onError?: (message: string) => void;
}

interface UseWorkingScheduleStreamResult {
  progress: number;
  courses: StreamCourse[];
  streamError: string | null;
  isRunning: boolean;
  doneData: WorkingScheduleDoneData | null;
  start: () => void;
  stop: () => void;
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeDone(raw: Partial<WorkingScheduleDoneData>): WorkingScheduleDoneData {
  const totalCreated = toNumber(raw.totalCreated);
  return {
    success: typeof raw.success === 'boolean' ? raw.success : totalCreated > 0,
    totalCreated,
    totalReplaced: toNumber(raw.totalReplaced),
    totalLockedReplaced: toNumber(raw.totalLockedReplaced),
    totalSkipped: toNumber(
      raw.totalSkipped,
      Array.isArray(raw.skipped) ? raw.skipped.length : 0,
    ),
    statusUpdated: raw.statusUpdated === true,
    message: typeof raw.message === 'string' ? raw.message : '',
    learningProcessStatus: raw.learningProcessStatus === 'created' ? 'created' : 'new',
    created: Array.isArray(raw.created) ? raw.created : [],
    skipped: Array.isArray(raw.skipped) ? raw.skipped : [],
  };
}

export function useWorkingScheduleStream({
  learningProcessId,
  approval,
  courses: selectedCourses,
  autoStart = false,
  onDone,
  onError,
}: UseWorkingScheduleStreamProps): UseWorkingScheduleStreamResult {
  const [progress, setProgress] = useState(0);
  const [courses, setCourses] = useState<StreamCourse[]>([]);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [doneData, setDoneData] = useState<WorkingScheduleDoneData | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const finishStream = (controller: AbortController) => {
    controller.abort();
    if (abortRef.current === controller) abortRef.current = null;
  };

  const failStream = (message: string, controller: AbortController) => {
    setStreamError(message);
    setIsRunning(false);
    finishStream(controller);
    onError?.(message);
  };

  const dispatchBlock = (block: string, controller: AbortController) => {
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }

    switch (eventName) {
      case 'start': {
        setCourses((parsed as { courses: StreamCourse[] }).courses);
        break;
      }
      case 'progress': {
        const p = parsed as {
          courseNum: number;
          status: StreamCourseStatus;
          percent: number;
          replaced?: number;
          lockedReplaced?: number;
          message?: string;
        };
        setProgress(p.percent);
        setCourses((prev) =>
          prev.map((c) =>
            c.courseNum === p.courseNum
              ? {
                  ...c,
                  status: p.status,
                  replaced: p.replaced,
                  lockedReplaced: p.lockedReplaced,
                  message: p.message,
                }
              : c,
          ),
        );
        break;
      }
      case 'done': {
        const data = normalizeDone(parsed as Partial<WorkingScheduleDoneData>);
        setProgress(100);
        setIsRunning(false);
        setDoneData(data);
        finishStream(controller);
        onDone?.(data);
        break;
      }
      case 'error': {
        const p = parsed as { message?: string };
        failStream(p.message ?? 'Xatolik yuz berdi', controller);
        break;
      }
      default:
        break;
    }
  };

  const consumeStream = async (response: Response, controller: AbortController) => {
    const body = response.body;
    if (!body) {
      failStream('Xatolik yuz berdi', controller);
      return;
    }
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

        let sepIndex = buffer.indexOf('\n\n');
        while (sepIndex !== -1) {
          const block = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          dispatchBlock(block, controller);
          if (controller.signal.aborted) return;
          sepIndex = buffer.indexOf('\n\n');
        }
      }
    } catch {
      if (controller.signal.aborted) return;
      failStream('Tarmoq uzildi', controller);
    }
  };

  const runStream = async (controller: AbortController, isRetry: boolean): Promise<void> => {
    const approvalParam = approval?.trim()
      ? `&approval=${encodeURIComponent(approval.trim())}`
      : '';
    const coursesParam =
      selectedCourses && selectedCourses.length > 0
        ? `&courses=${selectedCourses.join(',')}`
        : '';
    const url = `${appConfig.apiUrl}/working-schedules/generate-stream?learningProcess=${learningProcessId}${approvalParam}${coursesParam}`;
    const token = getAccessToken();

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {
      if (controller.signal.aborted) return;
      failStream('Tarmoq xatosi', controller);
      return;
    }

    if (controller.signal.aborted) return;

    if (response.status === 401 && !isRetry) {
      const newToken = await refreshAccessToken();
      if (controller.signal.aborted) return;
      if (newToken) {
        await runStream(controller, true);
        return;
      }
      failStream('Sessiya muddati tugadi — qayta kiring', controller);
      return;
    }

    if (!response.ok) {
      failStream(`Xatolik yuz berdi (${response.status})`, controller);
      return;
    }

    await consumeStream(response, controller);
  };

  const start = () => {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setProgress(0);
    setCourses([]);
    setStreamError(null);
    setDoneData(null);

    void runStream(controller, false);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsRunning(false);
  };

  useEffect(() => {
    if (autoStart) start();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, learningProcessId]);

  return { progress, courses, streamError, isRunning, doneData, start, stop };
}
