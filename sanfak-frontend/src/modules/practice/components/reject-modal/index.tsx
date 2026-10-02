import { useState } from 'react';
import { Input, Modal, Typography } from 'antd';

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
}

export function RejectModal({ open, onCancel, onConfirm, loading }: Props) {
  const [reason, setReason] = useState('');

  const submit = () => {
    if (reason.trim()) onConfirm(reason.trim());
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={submit}
      okText="Rad etish"
      okButtonProps={{ danger: true, disabled: !reason.trim() }}
      cancelText="Bekor qilish"
      title="Shartnomani rad etish"
      centered
      confirmLoading={loading}
      destroyOnHidden
      afterClose={() => setReason('')}
    >
      <Typography.Paragraph>Rad etish sababini kiriting:</Typography.Paragraph>
      <Input.TextArea
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Sabab..."
      />
    </Modal>
  );
}
