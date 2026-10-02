import { useEffect } from 'react';
import { App, Form, Input, Modal } from 'antd';

export interface RankTypeModalProps {
  open: boolean;
  initial?: string | null;
  existing: string[];
  onSubmit: (name: string) => void;
  onClose: () => void;
}

interface FormValues {
  name: string;
}

export function RankTypeModal({ open, initial, existing, onSubmit, onClose }: RankTypeModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const isEdit = !!initial;

  useEffect(() => {
    if (open) form.setFieldsValue({ name: initial ?? '' });
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const name = values.name.trim();
    const clash = existing
      .filter((n) => n !== initial)
      .some((n) => n.toLowerCase() === name.toLowerCase());
    if (clash) {
      message.error('Bunday unvon turi allaqachon mavjud');
      return;
    }
    onSubmit(name);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      title={isEdit ? 'Unvon turini tahrirlash' : "Unvon turi qo'shish"}
      okText="Saqlash"
      cancelText="Bekor qilish"
      centered
      destroyOnClose
      width={440}
    >
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
        <Form.Item
          label="Unvon turi nomi"
          name="name"
          rules={[
            { required: true, message: 'Unvon turi nomini kiriting' },
            { whitespace: true, message: 'Unvon turi nomini kiriting' },
          ]}
        >
          <Input placeholder="Masalan: Dotsent" allowClear autoFocus />
        </Form.Item>
      </Form>
    </Modal>
  );
}
