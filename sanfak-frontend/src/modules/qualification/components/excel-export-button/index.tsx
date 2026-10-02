import { Button } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';

interface IProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
}

export default function ExcelExportButton({ onClick, loading, disabled, label }: IProps) {
  const { t } = useTranslation();
  return (
    <Button
      icon={<FileExcelOutlined />}
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: disabled ? undefined : 'var(--brand-primary)',
        borderColor: disabled ? undefined : 'var(--brand-primary)',
        color: disabled ? undefined : '#fff',
      }}
    >
      {label ?? t('qualification.excelExport')}
    </Button>
  );
}
