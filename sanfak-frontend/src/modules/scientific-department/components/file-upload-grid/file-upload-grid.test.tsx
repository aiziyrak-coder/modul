import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import FileUploadGrid from './index';
import type { FileSlotConfig } from '../../model/types';

const slots: FileSlotConfig[] = [
  { slot: 'order', labelKey: 'files.order', format: '.pdf', accept: '.pdf', group: 'main' },
  { slot: 'contract', labelKey: 'files.contract', format: '.pdf', accept: '.pdf', group: 'main' },
];

const renderGrid = () =>
  render(
    <FileUploadGrid
      slots={slots}
      value={{ order: new File(['x'], 'CamScanner 24.06.2026 14.51.pdf') }}
      onChange={() => {}}
    />,
  );

function allRules(): string[] {
  return Array.from(document.styleSheets).flatMap((sheet) => {
    try {
      return Array.from(sheet.cssRules).map((r) => r.cssText);
    } catch {
      return [];
    }
  });
}

describe('FileUploadGrid', () => {
  it('ustunlar aniq teng — `minmax(0, 1fr)`, `1fr` EMAS', () => {
    renderGrid();
    const gridRules = allRules().filter((r) => r.includes('grid-template-columns'));

    expect(gridRules.length).toBeGreaterThan(0);
    expect(gridRules.some((r) => r.includes('minmax(0, 1fr)'))).toBe(true);
    expect(gridRules.some((r) => /grid-template-columns:\s*1fr 1fr/.test(r))).toBe(false);
  });

  it('antd Upload konteynerlari blok + to`liq kenglikka majburlangan', () => {
    renderGrid();
    const rule = allRules().find(
      (r) => r.includes('ant-upload-select') && !r.includes(':where('),
    );

    expect(rule).toBeDefined();
    expect(rule).toContain('display: block');
    expect(rule).toContain('width: 100%');
    expect(allRules().some((r) => r.includes(':where(') && r.includes('inline-block'))).toBe(true);
  });

  it('slot katagi `min-width: 0` (grid item kontentdan kichik bo`la olsin)', () => {
    renderGrid();
    const rule = allRules().find((r) => r.includes('min-width: 0') && r.includes('ant-upload'));

    expect(rule).toBeDefined();
  });

  it('fayl nomi qisqaradi (ellipsis stillari joyida)', () => {
    const { container } = renderGrid();
    const name = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent === 'CamScanner 24.06.2026 14.51.pdf' && s.children.length === 0,
    );

    expect(name).toBeDefined();
    expect(name?.style.overflow).toBe('hidden');
    expect(name?.style.textOverflow).toBe('ellipsis');
    expect(name?.style.whiteSpace).toBe('nowrap');
  });
});
