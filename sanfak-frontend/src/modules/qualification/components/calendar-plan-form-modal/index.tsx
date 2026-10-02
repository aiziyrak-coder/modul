import { useState } from 'react';
import { App, Button, Flex, Form, Input, Typography, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useCreateCalendarPlan } from '../../api/calendar-plan-api';
import FilePicker from '../file-picker';

const { Text } = Typography;
const LabelStyle = { fontWeight: 500, fontSize: 14, color: 'var(--color-text)' } as const;

interface FormValues {
  title: string;
}

export default function CalendarPlanForm() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [form] = Form.useForm<FormValues>();
  const [file, setFile] = useState<File | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const create = useCreateCalendarPlan();

  const onFinish = async (values: FormValues) => {
    if (!file) {
      message.error(t('qualification.calendarPlan.fileRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await create.mutateAsync({ title: values.title.trim(), file });
      message.success(t('qualification.calendarPlan.created'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
      <Form.Item
        name="title"
        label={<Text style={LabelStyle}>{t('qualification.calendarPlan.fieldName')}</Text>}
        rules={[{ required: true, message: t('qualification.calendarPlan.required') }]}
      >
        <Input size="large" placeholder={t('qualification.calendarPlan.fieldNamePh')} />
      </Form.Item>

      <Form.Item label={<Text style={LabelStyle}>{t('qualification.calendarPlan.fieldFile')}</Text>} required>
        <FilePicker
          value={file ? file.name : null}
          onFileSelect={(f) => setFile(f)}
          placeholder={t('qualification.calendarPlan.fileHint')}
          accept=".pdf,.xlsx,.docx"
          width="100%"
          status={file ? 'success' : 'idle'}
        />
      </Form.Item>

      <Flex
        justify="flex-end"
        gap={12}
        style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}
      >
        <Button onClick={hideModal} style={{ height: 44, minWidth: 100 }}>
          {t('cancel')}
        </Button>
        <Button type="primary" htmlType="submit" loading={submitting} style={{ height: 44, minWidth: 120 }}>
          {t('qualification.calendarPlan.upload')}
        </Button>
      </Flex>
    </Form>
  );
}
