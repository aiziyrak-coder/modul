import { useState } from 'react';
import { App, Button, Flex, Form, Input, Typography, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useCreateNotification, useUpdateNotification } from '../../api/notification-api';
import type { Notification } from '../../model/notification.types';

const { Text } = Typography;
const { TextArea } = Input;
const LabelStyle = { fontWeight: 500, fontSize: 14, color: 'var(--color-text)' } as const;

interface IProps {
  editItem?: Notification | null;
}

interface FormValues {
  text: string;
}

export default function NotificationForm({ editItem = null }: IProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const create = useCreateNotification();
  const update = useUpdateNotification();
  const isEdit = !!editItem;

  const onFinish = async (v: FormValues) => {
    setSubmitting(true);
    try {
      if (isEdit && editItem) {
        await update.mutateAsync({ id: editItem.id, input: { text: v.text.trim() } });
        message.success(t('qualification.notifications.updated'));
      } else {
        await create.mutateAsync({ text: v.text.trim() });
        message.success(t('qualification.notifications.created'));
      }
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      requiredMark={false}
      initialValues={{ text: editItem?.text ?? '' }}
    >
      <Form.Item
        name="text"
        label={<Text style={LabelStyle}>{t('qualification.notifications.fieldText')}</Text>}
        rules={[{ required: true, message: t('qualification.notifications.required') }]}
      >
        <TextArea rows={4} placeholder={t('qualification.notifications.fieldTextPh')} />
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
