import { App, Button, Flex, Form, Input, useModalStore } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useRejectApplicant } from '../../api/foreign-admission-api';
import type { Applicant } from '../../model/types';
import { ScrollBox } from '../scroll-box';

const REASON_MIN = 10;

export default function RejectForm({ applicant }: { applicant: Applicant }) {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const [form] = Form.useForm<{ reason: string }>();
  const reject = useRejectApplicant();

  const onSubmit = async () => {
    const { reason } = await form.validateFields();
    try {
      await reject.mutateAsync({ id: applicant.id, reason: reason.trim() });
      message.success(t('foreignAdmission.reject.done'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <>
      <ScrollBox>
      <Flex
        vertical
        gap={2}
        style={{
          background: 'var(--color-bg-elevate)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginBottom: 'var(--space-4)',
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>
          {t('foreignAdmission.col.name')}:
        </span>
        <strong>{applicant.fullName}</strong>
      </Flex>

      <Form form={form} layout="vertical">
        <Form.Item
          name="reason"
          label={t('foreignAdmission.reject.reason')}
          rules={[
            { required: true, message: t('foreignAdmission.err.required') },
            { min: REASON_MIN, message: t('foreignAdmission.reject.reason_min') },
          ]}
        >
          <Input.TextArea rows={4} placeholder={t('foreignAdmission.reject.reason_ph')} />
        </Form.Item>
      </Form>
      </ScrollBox>

      <Flex gap={10} style={{ paddingTop: 12 }}>
          <Button block onClick={hideModal}>
            {t('foreignAdmission.cancel')}
          </Button>
          <Button block danger type="primary" loading={reject.isPending} onClick={onSubmit}>
          {t('foreignAdmission.action.reject')}
        </Button>
      </Flex>
    </>
  );
}
