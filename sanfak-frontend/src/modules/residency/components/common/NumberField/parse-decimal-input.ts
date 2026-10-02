export function parseDecimalInput(displayValue?: string): string {
  return (
    String(displayValue ?? '')
      .replace(/\s/g, '')
      .replace(/,/g, '.')
  );
}

export const normalizeDecimalText = (raw: string): string => parseDecimalInput(raw);
