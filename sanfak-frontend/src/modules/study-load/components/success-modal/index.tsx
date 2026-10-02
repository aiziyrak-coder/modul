import { Button } from 'antd';
import { useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { SuccessWrapper } from './style';

interface IProps {
  title?: string;
  text?: string;
  onClose?: () => void;
}

const SuccessModal = ({ title, text, onClose }: IProps) => {
  const { t } = useTranslation();
  const hideModal = useModalStore((s) => s.hideModal);

  const handleClose = () => {
    hideModal();
    if (onClose) onClose();
  };

  return (
    <SuccessWrapper>
      <div className="pulse">
        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M50 0C22.45 0 0 22.45 0 50C0 77.55 22.45 100 50 100C77.55 100 100 77.55 100 50C100 22.45 77.55 0 50 0ZM73.9 38.5L45.55 66.85C44.85 67.55 43.9 67.95 42.9 67.95C41.9 67.95 40.95 67.55 40.25 66.85L26.1 52.7C24.65 51.25 24.65 48.85 26.1 47.4C27.55 45.95 29.95 45.95 31.4 47.4L42.9 58.9L68.6 33.2C70.05 31.75 72.45 31.75 73.9 33.2C75.35 34.65 75.35 37 73.9 38.5Z"
            fill="#34C18C"
          />
        </svg>
      </div>
      <div>
        <h2>{title ?? t('studyLoad.common.successDefaultTitle')}</h2>
        {text ? <p>{text}</p> : null}
      </div>
      <Button
        type="link"
        onClick={handleClose}
        style={{ minWidth: 246 }}
      >
        {t('studyLoad.common.continue')}
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ marginLeft: 8 }}
        >
          <path
            d="M4.16797 10H15.8346"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M10.832 4.16797L15.832 10.0013L10.832 15.8346"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Button>
    </SuccessWrapper>
  );
};

export default SuccessModal;
