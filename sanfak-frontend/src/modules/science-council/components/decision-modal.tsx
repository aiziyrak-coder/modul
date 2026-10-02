import { Form, Input, Modal, Radio, Select, DatePicker as AntDatePicker } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import type { DecisionInput, DecisionType } from '../model/types';
import { DOCUMENT_CATEGORIES } from '../lib/document-categories';

const { TextArea } = Input;

interface DecisionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: DecisionInput) => void;
  loading?: boolean;
  workId: string;
  allowedTypes?: DecisionType[];
  docKeyOptions?: string[];
  defaultType?: DecisionType;
}

export function DecisionModal({ open, onClose, onSubmit, loading, workId, allowedTypes, docKeyOptions, defaultType }: DecisionModalProps) {
  const { t, lang } = useTranslation();
  const [form] = Form.useForm<{ type: DecisionType; comment: string; revisionDocs?: string[]; seminarDate?: string; rejectionReason?: string }>();

  const types = allowedTypes ?? ['seminar', 'revision', 'rejected'];
  const decisionType = Form.useWatch('type', form);

  const handleOk = async () => {
    const values = await form.validateFields();
    const seminarDate = values.seminarDate
      ? typeof values.seminarDate === 'string'
        ? values.seminarDate
        : (values.seminarDate as unknown as { format: (f: string) => string }).format('YYYY-MM-DD')
      : undefined;
    onSubmit({
      workId,
      type: values.type,
      comment: values.comment,
      revisionDocs: values.revisionDocs,
      seminarDate,
      rejectionReason: values.rejectionReason,
    });
  };

  const docOptions = (docKeyOptions ?? DOCUMENT_CATEGORIES.map((c) => c.key))
    .map((key) => {
      const cat = DOCUMENT_CATEGORIES.find((c) => c.key === key);
      return { value: key, label: lang === 'ru' ? cat?.labelRu ?? key : cat?.labelUz ?? key };
    });

  return (
    <Modal
      title={t('scienceCouncil.actions')}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={loading}
      okText={t('scienceCouncil.confirm')}
      cancelText={t('scienceCouncil.cancel')}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" initialValues={{ type: defaultType ?? types[0] }}>
        <Form.Item name="type" label={t('scienceCouncil.actions')}>
          <Radio.Group>
            {types.includes('seminar') && <Radio value="seminar">{t('scienceCouncil.decision.seminar')}</Radio>}
            {types.includes('revision') && <Radio value="revision">{t('scienceCouncil.decision.revision')}</Radio>}
            {types.includes('rejected') && <Radio value="rejected">{t('scienceCouncil.decision.reject')}</Radio>}
          </Radio.Group>
        </Form.Item>

        <Form.Item name="comment" label={t('scienceCouncil.protocol.finalConclusion')} rules={[{ required: true }]}>
          <TextArea rows={4} maxLength={2000} showCount />
        </Form.Item>

        {decisionType === 'seminar' && (
          <Form.Item name="seminarDate" label={`${t('scienceCouncil.seminar.label')} — sana`}>
            <AntDatePicker style={{ width: '100%' }} />
          </Form.Item>
        )}

        {decisionType === 'revision' && (
          <Form.Item name="revisionDocs" label={t('scienceCouncil.tab.documents')}>
            <Select mode="multiple" options={docOptions} allowClear />
          </Form.Item>
        )}

        {decisionType === 'rejected' && (
          <Form.Item name="rejectionReason" label={t('scienceCouncil.decision.reject')}>
            <TextArea rows={3} maxLength={1000} showCount />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
