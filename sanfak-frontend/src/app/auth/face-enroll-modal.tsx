import { App as AntdApp, Modal } from 'antd';
import { getApiErrorMessage } from '@/shared/api';
import { faceEnrollRequest } from './api';
import { FaceLoginPanel } from './face-login-panel';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Tizimga kirgan xodim yuzini bir marta ro'yxatdan o'tkazadi — keyin yuz bilan kira oladi.
export function FaceEnrollModal({ open, onClose }: Props) {
  const { message } = AntdApp.useApp();

  const onCapture = async (frames: Blob[]): Promise<boolean> => {
    try {
      const res = await faceEnrollRequest(frames);
      message.success(res.message ?? 'Yuzingiz ro‘yxatdan o‘tkazildi');
      onClose();
      return true;
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Yuzni ro‘yxatdan o‘tkazib bo‘lmadi'));
      return false;
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} destroyOnClose title="Yuzni ro‘yxatdan o‘tkazish" width={460}>
      {open ? (
        <FaceLoginPanel
          frameCount={3}
          title="Yuz bilan kirish uchun yuzingizni saqlang"
          description="Kameraga to‘g‘ri qarang, ko‘zoynak va niqobsiz, yuzingiz yorug‘ bo‘lsin. 3 ta kadr olinadi, boshingizni qimirlatmang."
          buttonLabel="Yuzimni saqlash"
          onCapture={onCapture}
        />
      ) : null}
    </Modal>
  );
}
