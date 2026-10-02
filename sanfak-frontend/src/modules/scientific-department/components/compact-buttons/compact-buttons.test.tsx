import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from 'antd';
import CompactButtons from './index';

describe('CompactButtons', () => {
  it('ichidagi tugma balandligi 40px', () => {
    render(
      <CompactButtons>
        <Button>Orqaga</Button>
      </CompactButtons>,
    );
    const btn = screen.getByRole('button', { name: 'Orqaga' });
    expect(getComputedStyle(btn).height).toBe('40px');
  });

  it('o`ralmagan tugmadan FARQ qiladi (global balandlik o`zgarmaydi)', () => {
    render(
      <>
        <Button>Tashqarida</Button>
        <CompactButtons>
          <Button>Ichkarida</Button>
        </CompactButtons>
      </>,
    );
    const outside = getComputedStyle(screen.getByRole('button', { name: 'Tashqarida' })).height;
    const inside = getComputedStyle(screen.getByRole('button', { name: 'Ichkarida' })).height;

    expect(inside).toBe('40px');
    expect(inside).not.toBe(outside);
  });

  it('bolalarni o`zgarishsiz render qiladi', () => {
    render(
      <CompactButtons>
        <Button>PDF</Button>
      </CompactButtons>,
    );
    expect(screen.getByRole('button', { name: 'PDF' })).toBeDefined();
  });
});
