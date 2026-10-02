import { render, screen } from '@testing-library/react';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import { describe, expect, it } from 'vitest';
import { theme } from '../../../styles/theme';
import { SCORE_BLOCKED_TEXT } from '../../../api/session-types';
import type { LessonType } from '../../../api/types';
import { LESSON_TYPES } from '../../../lib/lesson-type';
import AnnounceSummary from './AnnounceSummary';

const OWNER_TEXT =
  'Amaliy mashg‘ulotga har dars uchun ball qo‘yilmaydi — oraliq nazorat orqali baholanadi';

function renderSummary(lessonType: LessonType) {
  render(
    <ThemeProvider theme={theme as unknown as DefaultTheme}>
      <AnnounceSummary
        draft={{ day: '2026-10-01', science: 'sc1', lessonType, group: 'g1', hours: 2 }}
        scienceTitle="Kardiologiya"
        groupTitle="ORD-101"
        count={2}
      />
    </ThemeProvider>,
  );
}

const ungradedNotes = () => screen.queryAllByRole('note', { name: 'Dars bali' });

describe('AnnounceSummary — «Dars bali» izohi (F1-Q11)', { timeout: 15_000 }, () => {
  it.each(LESSON_TYPES.map((t) => [t, t === 'amaliy' ? 1 : 0] as const))(
    '%s — «Dars bali» izohi: %i ta; «E’lon shartlari» doim bor',
    (lessonType, expected) => {
      renderSummary(lessonType);
      expect(ungradedNotes()).toHaveLength(expected);
      expect(screen.getByRole('note', { name: 'E’lon shartlari' })).toHaveTextContent(
        'kun yopilguncha bekor qilish mumkin',
      );
      expect(screen.getAllByRole('note')).toHaveLength(1 + expected);
    },
  );

  it('amaliy — matn AYNAN egasi matni, ‘ (U+2018), ASCII apostrof yo‘q', () => {
    renderSummary('amaliy');
    const text = screen.getByRole('note', { name: 'Dars bali' }).textContent;
    expect(text).toBe(SCORE_BLOCKED_TEXT.lessonTypeNotGraded);
    expect(text).toBe(OWNER_TEXT);
    expect(text).toMatch(/mashg‘ulotga/);
    expect(text).not.toContain("'");
  });

  it('amaliy — izoh xulosadan keyin, «E’lon shartlari» dan oldin; katak/qadam yo‘q', () => {
    renderSummary('amaliy');
    const summary = screen.getByLabelText('E’lon xulosasi');
    const ungraded = screen.getByRole('note', { name: 'Dars bali' });
    const terms = screen.getByRole('note', { name: 'E’lon shartlari' });
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(summary.compareDocumentPosition(ungraded) & FOLLOWING).toBeTruthy();
    expect(ungraded.compareDocumentPosition(terms) & FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
