import { useEffect } from 'react';
import { App, Form, Input, Modal, Switch } from 'antd';
import type { DocItem } from '../../model/types';

export interface DocItemModalProps {
  open: boolean;
  initial?: DocItem | null;
  existingNames: string[];
  onSubmit: (value: { name: string; required: boolean }) => void;
  onClose: () => void;
}

interface FormValues {
  name: string;
  required: boolean;
}

export function DocItemModal({ open, initial, existingNames, onSubmit, onClose }: DocItemModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const isEdit = !!initial;

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        name: initial?.name ?? '',
        required: initial?.required ?? true,
      });
    }
  }, [open, initial, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const name = values.name.trim();
    const clash = existingNames
      .filter((n) => n !== initial?.name)
      .some((n) => n.toLowerCase() === name.toLowerCase());
    if (clash) {
      message.error('Bunday nomli hujjat allaqachon mavjud');
      return;
    }
    onSubmit({ name, required: values.required });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      title={isEdit ? 'Hujjatni tahrirlash' : "Hujjat qo'shish"}
      okText="Saqlash"
      cancelText="Bekor qilish"
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      destroyOnClose
      width={440}
    >
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 12 }}>
        <Form.Item
          label="Hujjat nomi"
          name="name"
          rules={[
            { required: true, message: 'Hujjat nomini kiriting' },
            { whitespace: true, message: 'Hujjat nomini kiriting' },
          ]}
        >
          <Input placeholder="Masalan: Diplom nusxasi" allowClear />
        </Form.Item>
        <Form.Item label="Majburiy hujjat" name="required" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
