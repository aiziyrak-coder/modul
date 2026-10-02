import { useState } from 'react';
import { App, Button, Flex, Form, Input, InputNumber, Select, Typography, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useCreateTopic, useUpdateTopic } from '../../api/topic-api';
import { LESSON_KIND } from '../../model/topic.types';
import type { LessonKind, Topic } from '../../model/topic.types';

const { Text } = Typography;
const LabelStyle = { fontWeight: 500, fontSize: 14, color: 'var(--color-text)' } as const;

interface IProps {
  editTopic?: Topic | null;
  courseId: string;
  defaultOrder: number;
}

interface FormValues {
  title: string;
  code: string;
  duration: number;
  orderNumber: number;
  kind: LessonKind;
}

export default function TopicForm({ editTopic = null, courseId, defaultOrder }: IProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const create = useCreateTopic();
  const update = useUpdateTopic();
  const isEdit = !!editTopic;

  const initialValues: Partial<FormValues> = editTopic
    ? {
        title: editTopic.title,
        code: editTopic.code,
        duration: editTopic.duration,
        orderNumber: editTopic.orderNumber,
        kind: editTopic.kind,
      }
    : { kind: LESSON_KIND.THEORY, orderNumber: defaultOrder };

  const onFinish = async (v: FormValues) => {
    setSubmitting(true);
    try {
      if (isEdit && editTopic) {
        await update.mutateAsync({
          id: editTopic.id,
          input: {
            title: v.title.trim(),
            code: (v.code || '').trim(),
            duration: Number(v.duration),
            orderNumber: Number(v.orderNumber),
            kind: v.kind,
          },
        });
        message.success(t('qualification.curriculum.updated'));
      } else {
        await create.mutateAsync({
          title: v.title.trim(),
          code: (v.code || '').trim(),
          duration: Number(v.duration),
          orderNumber: Number(v.orderNumber),
          kind: v.kind,
          course: courseId,
        });
        message.success(t('qualification.curriculum.created'));
      }
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const req = [{ required: true, message: t('qualification.curriculum.required') }];

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} initialValues={initialValues}>
      <Form.Item
        name="title"
        label={<Text style={LabelStyle}>{t('qualification.curriculum.field.title')}</Text>}
        rules={req}
      >
        <Input size="large" placeholder={t('qualification.curriculum.field.titlePh')} />
      </Form.Item>

      <Form.Item
        name="code"
        label={<Text style={LabelStyle}>{t('qualification.curriculum.field.code')}</Text>}
      >
        <Input size="large" placeholder={t('qualification.curriculum.field.codePh')} maxLength={50} />
      </Form.Item>

      <Flex gap={12}>
        <Form.Item
          name="duration"
          label={<Text style={LabelStyle}>{t('qualification.curriculum.field.duration')}</Text>}
          rules={req}
          style={{ flex: 1 }}
        >
          <InputNumber size="large" min={1} style={{ width: '100%' }} placeholder="4" />
        </Form.Item>
        <Form.Item
          name="orderNumber"
          label={<Text style={LabelStyle}>{t('qualification.curriculum.field.order')}</Text>}
          rules={req}
          style={{ flex: 1 }}
        >
          <InputNumber size="large" min={1} style={{ width: '100%' }} placeholder="1" />
        </Form.Item>
      </Flex>

      <Form.Item
        name="kind"
        label={<Text style={LabelStyle}>{t('qualification.curriculum.field.kind')}</Text>}
        rules={req}
      >
        <Select
          size="large"
          options={[
            { value: LESSON_KIND.THEORY, label: t('qualification.curriculum.kind.theory') },
            { value: LESSON_KIND.PRACTICE, label: t('qualification.curriculum.kind.practice') },
          ]}
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
