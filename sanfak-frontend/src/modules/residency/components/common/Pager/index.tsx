import { MdChevronLeft, MdChevronRight } from '../../../icons';
import { Pagination, PageBtn } from '../FormElements';
import { ELLIPSIS, pageWindow } from '../../../lib/pagination';
import * as S from './style';

interface Props {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  arrows?: 'chars' | 'icons';
  hideWhenSingle?: boolean;
}

export default function Pager({
  page,
  totalPages,
  onPage,
  arrows = 'chars',
  hideWhenSingle = true,
}: Props) {
  if (hideWhenSingle && totalPages <= 1) return null;

  const slots = pageWindow(page, totalPages);

  return (
    <Pagination as="nav" aria-label="Sahifalash">
      <PageBtn
        type="button"
        aria-label="Oldingi sahifa"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        {arrows === 'icons' ? <MdChevronLeft /> : '‹'}
      </PageBtn>

      {slots.map((slot, i) =>
        slot === ELLIPSIS ? (
          <S.Gap key={`gap-${String(slots[i - 1])}`} aria-hidden="true">
            {ELLIPSIS}
          </S.Gap>
        ) : (
          <PageBtn
            key={slot}
            type="button"
            $active={slot === page}
            aria-current={slot === page ? 'page' : undefined}
            aria-label={`${slot}-sahifa`}
            onClick={() => onPage(slot)}
          >
            {slot}
          </PageBtn>
        ),
      )}

      <PageBtn
        type="button"
        aria-label="Keyingi sahifa"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
      >
        {arrows === 'icons' ? <MdChevronRight /> : '›'}
      </PageBtn>
    </Pagination>
  );
}
