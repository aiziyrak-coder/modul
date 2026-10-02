import { useState } from 'react';
import { Modal, Select, Typography } from 'antd';
import { ERI_KEYS } from '../../api/mock-data';
import type { EriKey } from '../../model/types';

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: (cert: EriKey) => void;
  loading?: boolean;
}

export function EriModal({ open, onCancel, onConfirm, loading }: Props) {
  const [serial, setSerial] = useState<string | undefined>();

  const submit = () => {
    const key = ERI_KEYS.find((k) => k.serialNumber === serial);
    if (key) onConfirm(key);
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={submit}
      okText="Tasdiqlash (E-imzo)"
      cancelText="Bekor qilish"
      title="Elektron raqamli imzo (ERI)"
      centered
      confirmLoading={loading}
      okButtonProps={{ disabled: !serial }}
      destroyOnHidden
      afterClose={() => setSerial(undefined)}
    >
      <Typography.Paragraph>Imzolash uchun ERI kalitini tanlang:</Typography.Paragraph>
      <Select
        style={{ width: '100%' }}
        placeholder="ERI kaliti"
        value={serial}
        onChange={setSerial}
        options={ERI_KEYS.map((k) => ({ value: k.serialNumber, label: `${k.subject} — ${k.serialNumber}` }))}
      />
    </Modal>
  );
}
