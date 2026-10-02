export function parseDecimalInput(displayValue?: string): string {
  return (
    String(displayValue ?? '')
      .replace(/\s/g, '')
      .replace(/,/g, '.')
  );
}
