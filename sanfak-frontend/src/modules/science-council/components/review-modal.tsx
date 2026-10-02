import { Form, Input, Modal, Radio, Select } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import type { ReviewInput, ReviewType } from '../model/types';
import { DOCUMENT_CATEGORIES } from '../lib/document-categories';

const { TextArea } = Input;

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ReviewInput) => void;
  loading?: boolean;
  workId: string;
  assignedDocKeys?: string[];
}

export function ReviewModal({ open, onClose, onSubmit, loading, workId, assignedDocKeys }: ReviewModalProps) {
  const { t, lang } = useTranslation();
  const [form] = Form.useForm<{ docKey: string; type: ReviewType; text: string }>();

  const docOptions = (assignedDocKeys ?? DOCUMENT_CATEGORIES.map((c) => c.key)).map((key) => {
    const cat = DOCUMENT_CATEGORIES.find((c) => c.key === key);
    return { value: key, label: lang === 'ru' ? cat?.labelRu ?? key : cat?.labelUz ?? key };
  });

  const handleOk = async () => {
    const values = await form.validateFields();
    onSubmit({ workId, ...values });
  };

  return (
    <Modal
      title={t('scienceCouncil.review.add')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={loading}
      okText={t('scienceCouncil.save')}
      cancelText={t('scienceCouncil.cancel')}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ type: 'positive' as ReviewType }}>
        <Form.Item name="docKey" label={t('scienceCouncil.tab.documents')} rules={[{ required: true }]}>
          <Select options={docOptions} />
        </Form.Item>
        <Form.Item name="type" label={t('scienceCouncil.work.type')}>
          <Radio.Group>
            <Radio value="positive">{t('scienceCouncil.review.positive')}</Radio>
            <Radio value="neutral">{t('scienceCouncil.review.neutral')}</Radio>
            <Radio value="negative">{t('scienceCouncil.review.negative')}</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="text" label={t('scienceCouncil.review.add')} rules={[{ required: true }]}>
          <TextArea rows={5} maxLength={3000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
