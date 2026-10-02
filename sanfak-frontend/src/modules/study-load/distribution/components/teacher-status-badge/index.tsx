import { Space, Tag, Tooltip, Typography } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { TeacherAcceptanceStatus } from '../../model/types';

const { Text } = Typography;

interface Props {
  status: TeacherAcceptanceStatus;
  rejectionReason: string | null;
  respondedAt: string | null;
  isVacant?: boolean;
}

function formatDateTime(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('uz-UZ');
}

export default function TeacherStatusBadge({
  status,
  rejectionReason,
  respondedAt,
  isVacant = false,
}: Props) {
  const { t } = useTranslation();

  if (isVacant) return null;

  const respondedText = formatDateTime(respondedAt);

  if (status === 'accepted') {
    return (
      <Tooltip title={respondedText ?? undefined}>
        <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginInlineEnd: 0 }}>
          {t('studyLoad.distribution.acceptance.accepted')}
        </Tag>
      </Tooltip>
    );
  }

  if (status === 'rejected') {
    const tooltip = (
      <Space direction="vertical" size={2}>
        <Text style={{ color: '#fff' }}>
          {rejectionReason || t('studyLoad.distribution.acceptance.noReason')}
        </Text>
        {respondedText ? (
          <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>{respondedText}</Text>
        ) : null}
      </Space>
    );

    return (
      <Tooltip title={tooltip}>
        <Tag color="error" icon={<InfoCircleOutlined />} style={{ marginInlineEnd: 0 }}>
          {t('studyLoad.distribution.acceptance.rejected')}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <Tag color="default" icon={<ClockCircleOutlined />} style={{ marginInlineEnd: 0 }}>
      {t('studyLoad.distribution.acceptance.pending')}
    </Tag>
  );
}
