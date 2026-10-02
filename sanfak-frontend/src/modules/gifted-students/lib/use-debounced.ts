import { useEffect, useState } from 'react';

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function normalizeSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function useDebouncedSearch(value: string, delay = 300): string {
  return useDebounced(normalizeSearch(value), delay);
}
