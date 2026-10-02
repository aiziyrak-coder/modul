import { App } from 'antd';
import { WarningFilled } from '@ant-design/icons';
import { ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { WrapperWarning } from './style';

interface IProps {
  title?: string;
  subtitle?: string;
  confirmText?: string;
  onConfirm?: () => void | Promise<unknown>;
  loading?: boolean;
  formatError?: (err: unknown) => string | null;
}

const WarningConfirm = ({
  title,
  subtitle,
  confirmText,
  onConfirm,
  loading = false,
  formatError,
}: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);

  const handleConfirm = async () => {
    try {
      await onConfirm?.();
      hideModal();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const detailed = formatError?.(e) ?? null;
      message.error(
        detailed ??
          err?.response?.data?.message ??
          err?.message ??
          t('studyLoad.common.errorOccurred'),
        detailed ? 10 : undefined,
      );
    }
  };

  return (
    <WrapperWarning>
      <div className="confirmation">
        <span className="pulse">
          <WarningFilled style={{ color: '#EF6820', fontSize: 24 }} />
        </span>
        <div>
          <div className="title">{title ?? t('studyLoad.common.confirmQuestion')}</div>
          {subtitle ? <div className="sub-title">{subtitle}</div> : null}
        </div>
      </div>
      <ModalFooter
        spacing="dialog"
        cancelLabel={t('studyLoad.common.cancel')}
        confirmLabel={confirmText ?? t('studyLoad.common.confirm')}
        loading={loading}
        onConfirm={() => void handleConfirm()}
      />
    </WrapperWarning>
  );
};

export default WarningConfirm;
