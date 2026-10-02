import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import dayjs from 'dayjs';
import DeadlineCell from './index';
import { deadlineBadge } from '../../model/deadline-badge';

const iso = (offsetDays: number) => dayjs().add(offsetDays, 'day').format('YYYY-MM-DD');

describe('deadlineBadge (sof mantiq)', () => {
  it('muddat o`tgan → overdue', () => {
    expect(deadlineBadge(-1)?.key).toBe('overdue');
    expect(deadlineBadge(-30)?.key).toBe('overdue');
  });

  it('bugun → endsToday', () => {
    expect(deadlineBadge(0)?.key).toBe('endsToday');
  });

  it('ertaga → oneDayLeft', () => {
    expect(deadlineBadge(1)?.key).toBe('oneDayLeft');
  });

  it('uzoq muddat → pilula YO`Q', () => {
    expect(deadlineBadge(2)).toBeNull();
    expect(deadlineBadge(365)).toBeNull();
  });
});

describe('DeadlineCell', () => {
  it.each([
    { label: 'muddat o`tgan', offset: -3 },
    { label: 'bugun tugaydi', offset: 0 },
    { label: '1 kun qoldi', offset: 1 },
    { label: 'uzoq muddat', offset: 30 },
  ])('$label — SANA har doim ko`rinadi', ({ offset }) => {
    const date = iso(offset);
    const { container } = render(<DeadlineCell deadline={date} />);
    expect(container.textContent, `sana yo'q: ${date}`).toContain(date);
  });

  it('yaqin/o`tgan muddatda pilula BOR, uzoqda YO`Q', () => {
    for (const offset of [-3, 0, 1]) {
      const { container } = render(<DeadlineCell deadline={iso(offset)} />);
      expect(container.querySelector('.ant-tag'), `pilula yo'q: ${offset}`).not.toBeNull();
    }
    const { container } = render(<DeadlineCell deadline={iso(30)} />);
    expect(container.querySelector('.ant-tag')).toBeNull();
  });

  it('muddat yo`q — chiziqcha', () => {
    const { container } = render(<DeadlineCell deadline={null} />);
    expect(container.textContent).toBe('—');
  });
});
