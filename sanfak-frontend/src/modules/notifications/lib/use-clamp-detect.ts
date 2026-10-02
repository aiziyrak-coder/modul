import { useEffect, useRef, useState, type RefObject } from 'react';

export interface ClampDetect<T extends HTMLElement> {
  ref: RefObject<T>;
  isClamped: boolean;
}

export function useClampDetect<T extends HTMLElement>(enabled: boolean): ClampDetect<T> {
  const ref = useRef<T>(null);
  const [isClamped, setIsClamped] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsClamped(false);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const measure = () => setIsClamped(el.scrollHeight > el.clientHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return { ref, isClamped };
}
