import { Alert, Tag, Tooltip } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';

interface IProps {
  editedAt: string | null;
  variant?: 'alert' | 'tag';
}

function formatDate(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('uz-UZ');
}

const PostApprovalEditBadge = ({ editedAt, variant = 'alert' }: IProps) => {
  const { t } = useTranslation();

  if (!editedAt) return null;

  const dateText = formatDate(editedAt);
  const title = t('studyLoad.workload.postApprovalEdit.title');

  if (variant === 'tag') {
    return (
      <Tooltip title={dateText ? `${title} — ${dateText}` : title}>
        <Tag
          color="warning"
          icon={<WarningOutlined />}
          style={{ marginInlineEnd: 0 }}
          aria-label={title}
        >
          {t('studyLoad.workload.postApprovalEdit.short')}
        </Tag>
      </Tooltip>
    );
  }

  return (
    <Alert
      type="warning"
      showIcon
      icon={<WarningOutlined />}
      style={{ marginBottom: 'var(--space-4)' }}
      message={dateText ? `${title} — ${dateText}` : title}
      description={t('studyLoad.workload.postApprovalEdit.pdfNote')}
    />
  );
};

export default PostApprovalEditBadge;
