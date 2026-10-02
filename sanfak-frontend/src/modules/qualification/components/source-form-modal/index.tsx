import { useState } from 'react';
import { App, Button, Flex, Form, Input, Select, Typography, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useCreateSource } from '../../api/source-api';
import { useCourseOptions } from '../../api/course-api';
import FilePicker from '../file-picker';

const { Text } = Typography;
const LabelStyle = { fontWeight: 500, fontSize: 14, color: 'var(--color-text)' } as const;

interface FormValues {
  title: string;
  course: string;
  link?: string;
}

export default function SourceForm() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [form] = Form.useForm<FormValues>();
  const [file, setFile] = useState<File | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const create = useCreateSource();
  const { data: courseOptions = [] } = useCourseOptions();

  const onFinish = async (values: FormValues) => {
    if (!file) {
      message.error(t('qualification.resources.fileRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await create.mutateAsync({
        title: values.title.trim(),
        course: values.course,
        link: values.link?.trim(),
        file,
      });
      message.success(t('qualification.resources.created'));
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
        label={<Text style={LabelStyle}>{t('qualification.resources.fieldName')}</Text>}
        rules={[{ required: true, message: t('qualification.resources.required') }]}
      >
        <Input size="large" placeholder={t('qualification.resources.fieldNamePh')} />
      </Form.Item>

      <Form.Item
        name="course"
        label={<Text style={LabelStyle}>{t('qualification.resources.fieldCourse')}</Text>}
        rules={[{ required: true, message: t('qualification.resources.required') }]}
      >
        <Select
          size="large"
          options={courseOptions}
          showSearch
          optionFilterProp="label"
          placeholder={t('qualification.resources.fieldCoursePh')}
        />
      </Form.Item>

      <Form.Item
        name="link"
        label={<Text style={LabelStyle}>{t('qualification.resources.fieldLink')}</Text>}
      >
        <Input size="large" placeholder="https://..." />
      </Form.Item>

      <Form.Item label={<Text style={LabelStyle}>{t('qualification.resources.fieldFile')}</Text>} required>
        <FilePicker
          value={file ? file.name : null}
          onFileSelect={(f) => setFile(f)}
          placeholder={t('qualification.resources.fileHint')}
          accept=".pdf,.docx,.xlsx,.pptx"
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
          {t('save')}
        </Button>
      </Flex>
    </Form>
  );
}
