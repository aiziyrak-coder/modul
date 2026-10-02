import Badge from '../common/Badge';
import {
  AUTO_NOTICE_REVOKED_LABEL,
  NOTICE_KIND_LABEL,
  isNoticeReadonly,
  type Notice,
} from '../../api/notice-types';
import { Wrap } from './style';

export default function AutoNoticeBadges({ notice }: { notice: Pick<Notice, 'kind' | 'auto'> }) {
  if (!isNoticeReadonly(notice)) return null;
  const year = notice.auto?.countingYear;
  return (
    <Wrap>
      <span title={year ? `Hisob yili: ${year}` : undefined}>
        <Badge variant="umumiy">{NOTICE_KIND_LABEL.avtomatik}</Badge>
      </span>
      {notice.auto?.state === 'bekor_qilingan' && (
        <Badge variant="nofaol">{AUTO_NOTICE_REVOKED_LABEL}</Badge>
      )}
    </Wrap>
  );
}
