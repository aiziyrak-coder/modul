import { useCallback, useState } from 'react';

export type ViewMode = 'table' | 'board';

const PREFIX = 'tm.view.';

const read = (key: string): ViewMode => {
  try {
    return localStorage.getItem(PREFIX + key) === 'board' ? 'board' : 'table';
  } catch {
    return 'table';
  }
};

export function useViewMode(key: string): [ViewMode, (v: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>(() => read(key));

  const update = useCallback(
    (v: ViewMode) => {
      setMode(v);
      try {
        localStorage.setItem(PREFIX + key, v);
      } catch {}
    },
    [key],
  );

  return [mode, update];
}
