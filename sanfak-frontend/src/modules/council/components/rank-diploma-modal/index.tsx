import { useEffect, useState } from 'react';
import { App, Button, DatePicker, Flex, Form, Modal, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { getApiErrorMessage } from '@/shared/api';
import { useRankSetDiploma } from '../../api/council-api';
import type { RankApplication } from '../../model/types';

const { Text } = Typography;

interface Props {
  application: RankApplication | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const UPLOAD_ACCEPT = '.pdf,.jpg,.jpeg,.png';

export function RankDiplomaModal({ application, onClose, onSuccess }: Props) {
  const { message, modal } = App.useApp();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [date, setDate] = useState<Dayjs | null>(null);
  const setDiploma = useRankSetDiploma();

  const existing = application?.diploma ?? null;

  useEffect(() => {
    if (!application) return;
    setFileList([]);
    setDate(application.diploma?.date ? dayjs(application.diploma.date) : null);
  }, [application]);

  const file = fileList[0]?.originFileObj;
  const canSave = Boolean(file) || Boolean(existing);

  const save = async () => {
    if (!application || !canSave) return;
    try {
      await setDiploma.mutateAsync({
        id: application.id,
        file: file ?? undefined,
        fileUrl: file ? undefined : (existing?.fileUrl ?? undefined),
        date: date ? date.toISOString() : undefined,
      });
      message.success('Diplom saqlandi');
      onClose();
      onSuccess?.();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const remove = () => {
    if (!application) return;
    modal.confirm({
      title: "Diplomni o'chirish",
      content: 'Biriktirilgan diplom olib tashlansinmi?',
      okText: "O'chirish",
      okType: 'danger',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: async () => {
        try {
          await setDiploma.mutateAsync({ id: application.id, fileUrl: '' });
          message.success("Diplom o'chirildi");
          onClose();
          onSuccess?.();
        } catch (e) {
          message.error(getApiErrorMessage(e));
        }
      },
    });
  };

  return (
    <Modal
      open={Boolean(application)}
      onCancel={onClose}
      onOk={save}
      okText="Saqlash"
      cancelText="Bekor qilish"
      title="Diplom"
      centered
      width={480}
      confirmLoading={setDiploma.isPending}
      okButtonProps={{ disabled: !canSave }}
      destroyOnHidden
    >
      {application && (
        <Form layout="vertical" style={{ marginTop: 8 }}>
          <Text type="secondary">
            Ariza egasi: <Text strong>{application.applicant.fullName || '—'}</Text>
          </Text>

          {existing?.fileUrl && (
            <Flex align="center" gap={12} style={{ margin: '12px 0' }} wrap>
              <Typography.Link href={existing.fileUrl} target="_blank" rel="noreferrer">
                <DownloadOutlined /> Diplomni ko'rish
              </Typography.Link>
              <Button size="small" danger onClick={remove}>
                O'chirish
              </Button>
            </Flex>
          )}

          <Form.Item label={existing ? 'Diplomni almashtirish' : 'Diplom fayli'} style={{ marginTop: 12 }}>
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

          <Form.Item label="Diplom sanasi">
            <DatePicker
              value={date}
              onChange={setDate}
              style={{ width: '100%' }}
              format="DD.MM.YYYY"
              placeholder="Sanani tanlang"
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
