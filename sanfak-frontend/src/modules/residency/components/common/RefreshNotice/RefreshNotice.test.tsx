import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { theme } from '../../../styles/theme';
import type { NoticeState } from '../../../lib/query-state';
import RefreshNotice from './index';

const AT = Date.parse('2026-09-27T05:00:00.000Z');

function renderIt(state: NoticeState, onRetry = vi.fn()) {
  const view = render(
    <ThemeProvider theme={theme as unknown as DefaultTheme}>
      <RefreshNotice state={state} updatedAt={AT} onRetry={onRetry} />
    </ThemeProvider>,
  );
  return { ...view, onRetry };
}

describe('RefreshNotice', () => {
  it.each<NoticeState>(['ok', 'loading'])('%s — hech narsa chizilmaydi', (state) => {
    expect(renderIt(state).container.textContent).toBe('');
  });

  it('error — oxirgi holat vaqti va qayta urinish', () => {
    const { onRetry } = renderIt('error');
    expect(screen.getByRole('status').textContent).toMatch(
      /^Yangilab bo.lmadi — ko.rsatilgan holat 10:00 dagi\./,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Qayta urinish' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('forbidden — sababi aytiladi', () => {
    renderIt('forbidden');
    expect(screen.getByRole('status').textContent).toMatch(/^Yangilab bo.lmadi \(ruxsat yo.q\) — /);
  });
});
