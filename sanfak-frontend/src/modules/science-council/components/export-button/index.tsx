import { useState } from 'react';
import { Button, Tooltip, App as AntApp } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';

interface ExportButtonProps {
  onExport: () => void | Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
}

export function ExportButton({ onExport, disabled, disabledReason }: ExportButtonProps) {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    setLoading(true);
    try {
      await onExport();
    } catch {
      message.error(t('scienceCouncil.export.failed'));
    } finally {
      setLoading(false);
    }
  };

  const btn = (
    <Button
      icon={<DownloadOutlined />}
      loading={loading}
      disabled={disabled}
      onClick={handle}
    >
      {t('scienceCouncil.export.xlsx')}
    </Button>
  );

  return disabled && disabledReason ? (
    <Tooltip title={disabledReason}>
      <span>{btn}</span>
    </Tooltip>
  ) : (
    btn
  );
}
