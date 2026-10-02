import { useState } from 'react';
import { Image } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { App, Button, Flex, Form, Input, Select, Typography, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useCreateCourseType } from '../../api/course-type-api';
import CertTemplatePreview from '../cert-template-preview';
import { CERT_PREVIEWS } from '../cert-template-preview/previews';
import type { CertTemplate, DocKind } from '../../model/course-type.types';

const { Text } = Typography;
const LabelStyle = { fontWeight: 500, fontSize: 14, color: 'var(--color-text)' } as const;
const TEMPLATES: CertTemplate[] = [1, 2, 3];

interface FormValues {
  title: string;
  docKind: DocKind;
}

export default function CourseTypeForm() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [form] = Form.useForm<FormValues>();
  const [template, setTemplate] = useState<CertTemplate>(1);
  const [preview, setPreview] = useState<CertTemplate | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const create = useCreateCourseType();

  const docKind = (Form.useWatch('docKind', form) ?? 'sertifikat') as DocKind;
  const showTemplate = docKind === 'sertifikat';

  const onFinish = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await create.mutateAsync({
        title: values.title.trim(),
        docKind: values.docKind,
        template: values.docKind === 'sertifikat' ? template : 1,
      });
      message.success(t('qualification.courseTypes.created'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} initialValues={{ docKind: 'sertifikat' }}>
      <Form.Item
        name="title"
        label={<Text style={LabelStyle}>{t('qualification.courseTypes.fieldName')}</Text>}
        rules={[{ required: true, message: t('qualification.courseTypes.required') }]}
      >
        <Input size="large" placeholder={t('qualification.courseTypes.fieldNamePh')} />
      </Form.Item>

      <Form.Item
        name="docKind"
        label={<Text style={LabelStyle}>{t('qualification.courseTypes.fieldDocType')}</Text>}
        rules={[{ required: true, message: t('qualification.courseTypes.required') }]}
      >
        <Select
          size="large"
          options={[
            { value: 'sertifikat', label: t('qualification.docKind.sertifikat') },
            { value: 'malumotnoma', label: t('qualification.docKind.malumotnoma') },
          ]}
        />
      </Form.Item>

      {showTemplate ? (
        <Form.Item label={<Text style={LabelStyle}>{t('qualification.courseTypes.fieldTemplate')}</Text>} required>
          <Flex gap={12} wrap>
            {TEMPLATES.map((n) => {
              const active = template === n;
              return (
                <div key={n} style={{ position: 'relative', flex: '1 1 0', minWidth: 110 }}>
                  <button
                    type="button"
                    onClick={() => setTemplate(n)}
                    style={{
                      width: '100%',
                      cursor: 'pointer',
                      padding: 8,
                      borderRadius: 'var(--radius-md)',
                      background: active ? 'var(--brand-primary-bg, #eafaf3)' : 'var(--color-bg)',
                      border: `2px solid ${active ? 'var(--brand-primary, #37cb94)' : 'var(--color-border, #e3e8ef)'}`,
                    }}
                  >
                    <div style={{ marginBottom: 8 }}>
                      <CertTemplatePreview template={n} />
                    </div>
                    <Text style={{ fontWeight: 500, fontSize: 13 }}>
                      {t(`qualification.courseTypes.templateName${n}`)}
                    </Text>
                  </button>
                  <button
                    type="button"
                    title={t('qualification.courseTypes.templatePreview')}
                    aria-label={t('qualification.courseTypes.templatePreview')}
                    onClick={() => setPreview(n)}
                    style={{
                      position: 'absolute',
                      top: 'var(--space-2)',
                      right: 'var(--space-2)',
                      width: 'var(--space-7)',
                      height: 'var(--space-7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      background: 'var(--color-bg, #fff)',
                      border: '1px solid var(--color-border, #e3e8ef)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-text-secondary, #667085)',
                      cursor: 'pointer',
                    }}
                  >
                    <EyeOutlined />
                  </button>
                </div>
              );
            })}
          </Flex>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
            {t('qualification.courseTypes.templatePreviewHint')}
          </Text>
          {preview !== null ? (
            <Image
              style={{ display: 'none' }}
              src={CERT_PREVIEWS[preview]}
              preview={{
                visible: true,
                src: CERT_PREVIEWS[preview],
                onVisibleChange: (v) => {
                  if (!v) setPreview(null);
                },
              }}
            />
          ) : null}
        </Form.Item>
      ) : null}

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
