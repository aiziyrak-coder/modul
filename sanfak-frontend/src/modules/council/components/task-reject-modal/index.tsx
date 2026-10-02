import { useEffect } from 'react';
import { Form, Input, Modal } from 'antd';

interface Props {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

interface FormValues {
  reason: string;
}

export function TaskRejectModal({ open, loading, onCancel, onConfirm }: Props) {
  const [form] = Form.useForm<FormValues>();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => onConfirm(values.reason.trim()))
      .catch(() => undefined);
  };

  return (
    <Modal
      open={open}
      title="Topshiriqni rad etish"
      okText="Rad etish"
      okType="danger"
      cancelText="Bekor qilish"
      confirmLoading={loading}
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="reason"
          label="Rad etish sababi"
          rules={[{ required: true, message: 'Sababni kiriting' }]}
        >
          <Input.TextArea rows={3} placeholder="Rad etish sababini yozing" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
