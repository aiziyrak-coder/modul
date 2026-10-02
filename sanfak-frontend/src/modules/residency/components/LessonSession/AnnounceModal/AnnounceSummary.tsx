import { SCORE_BLOCKED_TEXT, type AnnounceSessionInput } from '../../../api/session-types';
import { isLessonTypeGraded, lessonLabel } from '../../../lib/lesson-type';
import { formatDayKey } from '../../../lib/uz-day';
import * as S from './style';

export default function AnnounceSummary({
  draft,
  scienceTitle,
  groupTitle,
  count,
}: {
  draft: AnnounceSessionInput;
  scienceTitle: string;
  groupTitle: string;
  count: number | null;
}) {
  const rows: Array<[string, string]> = [
    ['Sana', formatDayKey(draft.day)],
    ['Fan', scienceTitle],
    ['Dars turi', lessonLabel(draft.lessonType)],
    ['Guruh', groupTitle],
    ['Soat', `${draft.hours} soat`],
    ['Rezidentlar', count === null ? '—' : `${count} ta`],
  ];
  return (
    <>
      <S.Summary aria-label="E’lon xulosasi">
        {rows.map(([k, v]) => (
          <S.SummaryRow key={k}>
            <S.SummaryKey>{k}</S.SummaryKey>
            <S.SummaryVal>{v}</S.SummaryVal>
          </S.SummaryRow>
        ))}
      </S.Summary>
      {!isLessonTypeGraded(draft.lessonType) && (
        <S.UngradedNote role="note" aria-label="Dars bali">
          {SCORE_BLOCKED_TEXT.lessonTypeNotGraded}
        </S.UngradedNote>
      )}
      <S.Warning role="note" aria-label="E’lon shartlari">
        E’lon qilingan mashg‘ulotni kun yopilguncha bekor qilish mumkin. Davomat SAMS (turniket yoki
        mobil ilova) ma’lumotidan avtomatik aniqlanadi; SAMS ma’lumoti bo‘lmagan kun «kelmadi»
        hisoblanmaydi.
      </S.Warning>
    </>
  );
}
