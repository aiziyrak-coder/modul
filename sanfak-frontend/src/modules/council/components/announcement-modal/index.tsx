import { useEffect, useState } from 'react';
import { App, Button, Flex, Form, Input, Modal, Select, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { getApiErrorMessage } from '@/shared/api';
import type { AnnouncementInput } from '../../api/backend';
import type { RecipientGroup } from '../../model/types';
import { useAnnouncementCreate } from '../../api/council-api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const RECIPIENT_OPTIONS: { value: RecipientGroup; label: string }[] = [
  { value: 'all', label: "Barcha o'qituvchilar" },
  { value: 'professors', label: 'Professorlar' },
  { value: 'dotsents', label: 'Dotsentlar' },
  { value: 'deptHeads', label: 'Kafedra mudirlari' },
];

const UPLOAD_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';

export function AnnouncementModal({ open, onClose, onSuccess }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<AnnouncementInput>();
  const create = useAnnouncementCreate();
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setFileList([]);
    }
  }, [open, form]);

  const onFinish = async (values: AnnouncementInput) => {
    try {
      await create.mutateAsync({ input: values, file: fileList[0]?.originFileObj });
      message.success("E'lon yuborildi");
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
      footer={null}
      title="E'lon yuborish"
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      width={560}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ recipientGroup: 'all' }}
        requiredMark={false}
        style={{ marginTop: 8 }}
      >
        <Form.Item
          name="title"
          label="Sarlavha"
          rules={[{ required: true, message: 'Sarlavha kiriting' }]}
        >
          <Input placeholder="E'lon sarlavhasi" maxLength={200} />
        </Form.Item>

        <Form.Item
          name="content"
          label="Matn"
          rules={[{ required: true, message: 'Matn kiriting' }]}
        >
          <Input.TextArea placeholder="E'lon matni" rows={5} maxLength={2000} showCount />
        </Form.Item>

        <Form.Item
          name="recipientGroup"
          label="Qabul qiluvchilar"
          rules={[{ required: true, message: 'Guruhni tanlang' }]}
        >
          <Select options={RECIPIENT_OPTIONS} placeholder="Guruhni tanlang" />
        </Form.Item>

        <Form.Item label="Fayl (ixtiyoriy)">
          <Upload
            maxCount={1}
            beforeUpload={() => false}
            accept={UPLOAD_ACCEPT}
            fileList={fileList}
            onChange={({ fileList: fl }) => setFileList(fl)}
          >
            <Button icon={<UploadOutlined />}>Fayl tanlash</Button>
          </Upload>
        </Form.Item>

        <Flex justify="flex-end" gap={12} style={{ marginTop: 8 }}>
          <Button onClick={onClose}>Bekor qilish</Button>
          <Button type="primary" htmlType="submit" loading={create.isPending}>
            Yuborish
          </Button>
        </Flex>
      </Form>
    </Modal>
  );
}
