import { WarningOutlined } from '@ant-design/icons';
import { ModalFooter } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { WrapperDelete } from './style';

interface IProps {
  title?: string;
  subtitle?: string;
  loading?: boolean;
  onConfirm?: () => void;
}

const DeleteConfirm = ({ title, subtitle, loading = false, onConfirm }: IProps) => {
  const { t } = useTranslation();

  return (
    <WrapperDelete>
      <div className="confirmation">
        <span className="pulse">
          <WarningOutlined style={{ color: '#F04438', fontSize: 24 }} />
        </span>
        <div>
          <div className="title">{title ?? t('studyLoad.common.deleteConfirmTitle')}</div>
          <div className="sub-title">{subtitle ?? t('studyLoad.common.deleteConfirmSubtitle')}</div>
        </div>
      </div>

      <ModalFooter
        spacing="dialog"
        danger
        cancelLabel={t('studyLoad.common.cancel')}
        confirmLabel={t('studyLoad.common.delete')}
        loading={loading}
        onConfirm={onConfirm}
      />
    </WrapperDelete>
  );
};

export default DeleteConfirm;
