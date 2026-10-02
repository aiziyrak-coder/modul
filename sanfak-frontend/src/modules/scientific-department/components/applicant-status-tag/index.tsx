import { Tag, Tooltip } from 'antd';
import { InfoCircleFilled } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { ApplicantStatus } from '../../model/types';

const COLOR: Record<ApplicantStatus, string> = {
  new: 'blue',
  approved: 'green',
  rejected: 'red',
  passed: 'green',
  failed: 'red',
};

export default function ApplicantStatusTag({
  status,
  reason,
}: {
  status: ApplicantStatus;
  reason?: string | null;
}) {
  const { t } = useTranslation();
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <Tag color={COLOR[status]} style={{ marginInlineEnd: 4 }}>
        {t(`scientificDepartment.exam.status.${status}`)}
      </Tag>
      {status === 'rejected' && reason ? (
        <Tooltip title={reason}>
          <InfoCircleFilled style={{ color: 'var(--brand-error)' }} />
        </Tooltip>
      ) : null}
    </span>
  );
}
