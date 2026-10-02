export function readableFallback(key: string): string {
  const tail = key.split('.').pop();
  return tail && tail.length > 0 ? tail : key;
}
