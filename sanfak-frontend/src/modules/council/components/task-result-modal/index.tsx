import { useEffect, useState } from 'react';
import { UploadOutlined } from '@ant-design/icons';
import { Button, Modal, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd';
import type { CouncilTask } from '../../model/types';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.docx';
const MAX_FILES = 10;

interface Props {
  open: boolean;
  task: CouncilTask | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (files: File[]) => void;
}

export function TaskResultModal({ open, task, loading, onCancel, onConfirm }: Props) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    if (open) setFileList([]);
  }, [open]);

  const handleOk = () => {
    const files: File[] = [];
    for (const item of fileList) {
      if (item.originFileObj) files.push(item.originFileObj);
    }
    if (files.length === 0) return;
    onConfirm(files);
  };

  return (
    <Modal
      open={open}
      title="Natija yuklash"
      okText="Yuborish"
      cancelText="Bekor qilish"
      confirmLoading={loading}
      okButtonProps={{ disabled: fileList.length === 0 }}
      centered
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      onOk={handleOk}
      onCancel={onCancel}
      destroyOnHidden
    >
      {task && (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
          {task.title}
        </Typography.Text>
      )}
      <Upload
        multiple
        accept={ACCEPT}
        maxCount={MAX_FILES}
        fileList={fileList}
        beforeUpload={() => false}
        onChange={({ fileList: next }) => setFileList(next.slice(0, MAX_FILES))}
      >
        <Button icon={<UploadOutlined />}>Fayl tanlash</Button>
      </Upload>
      <Typography.Text type="secondary" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
        PDF, JPG, PNG yoki DOCX — ko'pi bilan {MAX_FILES} ta fayl.
      </Typography.Text>
    </Modal>
  );
}
