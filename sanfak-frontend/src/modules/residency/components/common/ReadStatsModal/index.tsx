import { MdCheckCircle, MdAccessTime } from '../../../icons';
import Modal, { ModalBody } from '../Modal';
import { useAnnouncementReadStats } from '../../../api/announcement-api';
import type { ReadStatsRow } from '../../../api/announcement-types';
import { formatDate } from '../../../api/curriculum-types';
import { getApiErrorMessage } from '@/shared/api';
import * as S from './style';

interface Props {
  announcementId: string | null;
  announcementTitle: string;
  onClose: () => void;
}

function PersonRow({ row }: { row: ReadStatsRow }) {
  const bits = [
    row.courseNumber ? `${row.courseNumber}-kurs` : null,
    row.specialtyTitle,
  ].filter(Boolean);

  return (
    <S.Row>
      <S.Name title={row.fullName}>{row.fullName}</S.Name>
      {bits.length > 0 && <S.Meta>{bits.join(' · ')}</S.Meta>}
      {row.readAt && <S.Meta>{formatDate(row.readAt)}</S.Meta>}
    </S.Row>
  );
}

export default function ReadStatsModal({
  announcementId,
  announcementTitle,
  onClose,
}: Props) {
  const { data, isLoading, error } = useAnnouncementReadStats(announcementId);

  return (
    <Modal
      open={!!announcementId}
      onClose={onClose}
      title={`O‘qilganlik hisoboti — ${announcementTitle}`}
      width="560px"
    >
      <ModalBody>
        {isLoading && <S.State>Yuklanmoqda…</S.State>}

        {!isLoading && error && (
          <S.State role="alert">
            {getApiErrorMessage(error, 'Hisobotni olishda xatolik')}
          </S.State>
        )}

        {!isLoading && !error && data && (
          <>
            <S.Summary>
              <S.Percent>{data.percent === null ? '—' : `${data.percent}%`}</S.Percent>
              <S.SummaryBody>
                <S.Counts>
                  <span>
                    O‘qigan: <b>{data.readCount}</b>
                  </span>
                  <span>
                    O‘qimagan: <b>{data.unreadCount}</b>
                  </span>
                  <span>
                    Jami yuborilgan: <b>{data.total}</b>
                  </span>
                </S.Counts>
                <S.Track
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={data.percent ?? 0}
                  aria-label="O‘qilganlik ulushi"
                >
                  <S.Bar $percent={data.percent ?? 0} />
                </S.Track>
              </S.SummaryBody>
            </S.Summary>

            {data.total === 0 && (
              <S.Empty>
                Bu e’lon hech bir talabaga yo‘naltirilmagan (auditoriya —
                kafedra mudirlari yoki mos talaba yo‘q), shuning uchun
                o‘qilganlik hisobi yuritilmaydi.
              </S.Empty>
            )}

            {data.total > 0 && (
              <>
                <S.Section>
                  <S.SectionTitle $tone="read">
                    <MdCheckCircle size={14} />
                    O‘qiganlar ({data.readCount})
                  </S.SectionTitle>
                  {data.read.length ? (
                    <S.List aria-label="O‘qiganlar">
                      {data.read.map((r) => (
                        <PersonRow key={r.user} row={r} />
                      ))}
                    </S.List>
                  ) : (
                    <S.Empty>Hali hech kim o‘qimagan</S.Empty>
                  )}
                </S.Section>

                <S.Section>
                  <S.SectionTitle $tone="unread">
                    <MdAccessTime size={14} />
                    O‘qimaganlar ({data.unreadCount})
                  </S.SectionTitle>
                  {data.unread.length ? (
                    <S.List aria-label="O‘qimaganlar">
                      {data.unread.map((r) => (
                        <PersonRow key={r.user} row={r} />
                      ))}
                    </S.List>
                  ) : (
                    <S.Empty>Hamma o‘qigan</S.Empty>
                  )}
                </S.Section>
              </>
            )}
          </>
        )}
      </ModalBody>
    </Modal>
  );
}
