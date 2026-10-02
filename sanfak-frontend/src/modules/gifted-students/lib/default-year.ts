import { useCallback, useEffect, useRef, useState } from 'react';

export function newestYearWithData(values: readonly (string | null | undefined)[]): string {
  const years = values.filter((v): v is string => !!v);
  return years.length ? [...years].sort().reverse()[0]! : '';
}

export function useYearFilter(
  values: readonly (string | null | undefined)[],
  initial: string = 'all',
): [string, (year: string) => void] {
  const [year, setYear] = useState(initial);
  const settled = useRef(false);
  const newest = newestYearWithData(values);

  useEffect(() => {
    if (!settled.current && newest) {
      settled.current = true;
      setYear(newest);
    }
  }, [newest]);

  const choose = useCallback((next: string) => {
    settled.current = true;
    setYear(next);
  }, []);

  return [year, choose];
}
