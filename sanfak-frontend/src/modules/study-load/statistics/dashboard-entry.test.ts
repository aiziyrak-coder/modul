import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REGISTRY = resolve(process.cwd(), 'src', 'modules', 'dashboard', 'model', 'registry.ts');

describe('dashboard registry — study-load "Batafsil" entries[] (2026-09-08)', () => {
  const src = readFileSync(REGISTRY, 'utf8');
  const start = src.indexOf("key: 'study-load'");
  const nextCardStart = src.indexOf("key: '", start + 1);
  const block = start >= 0 ? src.slice(start, nextCardStart >= 0 ? nextCardStart : undefined) : '';

  it('study-load kartasi registrda topildi', () => {
    expect(start).toBeGreaterThan(-1);
  });

  it("entries[] statistika sahifasini `statistics:read` bilan e'lon qiladi", () => {
    expect(block).toContain("path: '/study-load/statistics'");
    expect(block).toContain("permission: 'statistics:read'");
  });

  it("muqobil (rektor uchun) approval-inbox saqlanib qolgan — `workload:readAll`", () => {
    expect(block).toContain("path: '/study-load/approval-inbox'");
    expect(block).toContain("permission: 'workload:readAll'");
  });
});
