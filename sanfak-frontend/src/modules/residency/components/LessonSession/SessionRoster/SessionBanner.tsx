import type { ReactNode } from 'react';
import { Btn } from '../../common/FormElements';
import Badge from '../../common/Badge';
import {
  SESSION_STATUS_LABEL,
  SESSION_STATUS_VARIANT,
  type LessonSession,
} from '../../../api/session-types';
import { lessonLabel } from '../../../lib/lesson-type';
import { formatDayKey, formatUzDateTime } from '../../../lib/uz-day';
import * as S from './style';

function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <S.MetaItem>
      <S.MetaLabel>{label}</S.MetaLabel>
      <S.MetaValue>{children}</S.MetaValue>
    </S.MetaItem>
  );
}

function StatusBadge({ session }: { session: LessonSession }) {
  if (!session.status) return <Badge variant="nofaol">Noma’lum</Badge>;
  return (
    <Badge variant={SESSION_STATUS_VARIANT[session.status]}>
      {SESSION_STATUS_LABEL[session.status]}
    </Badge>
  );
}

function CancelledNote({ session }: { session: LessonSession }) {
  if (session.status !== 'cancelled') return null;
  const who = session.cancelledByName ? ` · ${session.cancelledByName}` : '';
  return (
    <S.CancelledNote>
      Bekor qilingan: {formatUzDateTime(session.cancelledAt)}
      {who}
      {session.cancelReason ? ` — «${session.cancelReason}»` : ''}
    </S.CancelledNote>
  );
}

export default function SessionBanner({
  session,
  onCancel,
}: {
  session: LessonSession;
  onCancel?: () => void;
}) {
  return (
    <S.Banner>
      <S.BannerHead>
        <S.BannerTitle>{session.scienceTitle ?? 'Fan ko‘rsatilmagan'}</S.BannerTitle>
        {onCancel && (
          <Btn $variant="danger" $size="sm" onClick={onCancel}>
            Bekor qilish
          </Btn>
        )}
      </S.BannerHead>
      <S.Meta>
        <MetaItem label="Sana">{formatDayKey(session.day)}</MetaItem>
        <MetaItem label="Dars turi">{lessonLabel(session.lessonType)}</MetaItem>
        <MetaItem label="Guruh">{session.groupTitle ?? '—'}</MetaItem>
        <MetaItem label="Soat">{session.hours ?? '—'}</MetaItem>
        <MetaItem label="O‘qituvchi">{session.teacherName ?? '—'}</MetaItem>
        <MetaItem label="Holat">
          <StatusBadge session={session} />
        </MetaItem>
      </S.Meta>
      <CancelledNote session={session} />
    </S.Banner>
  );
}
