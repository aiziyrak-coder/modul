import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import StageDesc from './index';

describe('StageDesc', () => {
  it('matn va sana ALOHIDA bloklarda (bir qatorda emas)', () => {
    const { container } = render(<StageDesc label="Tasdiqladi" date="2026-07-22" />);
    const divs = Array.from(container.querySelectorAll('div'));

    expect(divs.map((d) => d.textContent)).toEqual(['Tasdiqladi', '2026-07-22']);
    expect(divs.filter((d) => d.textContent === 'Tasdiqladi2026-07-22')).toEqual([]);
  });

  it('sana bo`linmaydi (`white-space: nowrap`)', () => {
    const { container } = render(<StageDesc label="Tasdiqladi" date="2026-07-22" />);
    const dateEl = Array.from(container.querySelectorAll('div')).find(
      (d) => d.textContent === '2026-07-22',
    );

    expect(dateEl).toBeDefined();
    expect(dateEl?.style.whiteSpace).toBe('nowrap');
  });

  it('sana yo`q bo`lsa faqat matn — bo`sh qator qo`shilmaydi', () => {
    const { container } = render(<StageDesc label="Kutilmoqda" />);

    expect(container.textContent).toBe('Kutilmoqda');
    expect(container.querySelectorAll('div').length).toBe(0);
  });

  it('matn yo`q, sana bor — faqat sana bloki', () => {
    const { container } = render(<StageDesc label="" date="2026-07-21" />);
    const divs = Array.from(container.querySelectorAll('div'));

    expect(divs.map((d) => d.textContent)).toEqual(['2026-07-21']);
  });
});
