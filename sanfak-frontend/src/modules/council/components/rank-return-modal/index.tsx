import { useEffect, useState } from 'react';
import { App, Input, Modal, Typography } from 'antd';
import { getApiErrorMessage } from '@/shared/api';
import { useRankReturn } from '../../api/council-api';
import type { RankApplication } from '../../model/types';

interface Props {
  open: boolean;
  application: RankApplication | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RankReturnModal({ open, application, onClose, onSuccess }: Props) {
  const { message } = App.useApp();
  const [reason, setReason] = useState('');
  const returnApp = useRankReturn();

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const submit = async () => {
    if (!application || !reason.trim()) return;
    try {
      await returnApp.mutateAsync({ id: application.id, reason: reason.trim() });
      message.success('Ariza qaytarildi');
      onClose();
      onSuccess?.();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Qaytarish"
      okButtonProps={{ danger: true, disabled: !reason.trim() }}
      cancelText="Bekor qilish"
      title="Arizani qaytarish"
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      confirmLoading={returnApp.isPending}
      destroyOnHidden
    >
      <Typography.Paragraph>Qaytarish sababini kiriting:</Typography.Paragraph>
      <Input.TextArea
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Sabab..."
      />
    </Modal>
  );
}
