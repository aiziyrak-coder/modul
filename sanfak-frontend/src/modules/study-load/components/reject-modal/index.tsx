import { useRef, useState } from 'react';
import { App, Col, Form, Input, Row, Spin, Typography } from 'antd';
import { ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import RevokeDependentsAlert from '../revoke-dependents-alert';
import { extractRevokeDependents, type RevokeDependent } from '../../lib/final-step';

const REJECT_COMMENT_MAX = 1000;

interface IProps {
  title: string;
  onConfirm: (comment: string) => Promise<void>;
  loading?: boolean;
  recordName?: string;
  confirmLabel?: string;
  successMessage?: string;
}

const RejectModal = ({
  title,
  onConfirm,
  loading = false,
  recordName,
  confirmLabel,
  successMessage,
}: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);

  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const [dependents, setDependents] = useState<RevokeDependent[]>([]);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const isCommentEmpty = comment.trim().length === 0;

  const handleConfirm = async () => {
    setTouched(true);
    if (isCommentEmpty || submittingRef.current) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onConfirm(comment.trim());
      message.success(successMessage ?? t('studyLoad.common.rejectedToast'));
      hideModal();
    } catch (e) {
      const blocking = extractRevokeDependents(e);
      if (blocking.length > 0) {
        setDependents(blocking);
        return;
      }
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const text =
        err?.response?.data?.message ?? err?.message ?? t('studyLoad.common.errorOccurred');
      message.error(text);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <Row gutter={[12, 20]}>
        {recordName ? (
          <Col span={24}>
            <div
              style={{
                background: 'var(--color-bg-layout, #F5F7FB)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3) var(--space-4)',
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {title}
              </Typography.Text>
              <div>
                <Typography.Text strong style={{ fontSize: 14 }}>
                  {recordName}
                </Typography.Text>
              </div>
            </div>
          </Col>
        ) : null}

        <Col span={24}>
          <Form layout="vertical">
            <Form.Item
              label={t('studyLoad.common.rejectReason')}
              required
              validateStatus={touched && isCommentEmpty ? 'error' : ''}
              help={touched && isCommentEmpty ? t('studyLoad.common.rejectReasonRequired') : undefined}
            >
              <Input.TextArea
                rows={4}
                placeholder={t('studyLoad.common.rejectReasonPlaceholder')}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onBlur={() => setTouched(true)}
                maxLength={REJECT_COMMENT_MAX}
                showCount
                style={{ resize: 'none' }}
              />
            </Form.Item>
          </Form>
        </Col>

        {dependents.length > 0 ? (
          <Col span={24}>
            <RevokeDependentsAlert dependents={dependents} />
          </Col>
        ) : null}

        <Col span={24}>
          <ModalFooter
            spacing="none"
            danger
            cancelLabel={t('studyLoad.common.cancel')}
            confirmLabel={confirmLabel ?? t('studyLoad.common.reject')}
            loading={loading || submitting}
            onConfirm={() => void handleConfirm()}
          />
        </Col>
      </Row>
    </div>
  );
};

export default RejectModal;
