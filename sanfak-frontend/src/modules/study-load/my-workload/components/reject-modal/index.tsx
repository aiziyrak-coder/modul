import { useState } from 'react';
import { App, Alert, Form, Input, Typography, Space } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';
import { ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useRespondWorkload, getApiErrorMessage } from '../../api/my-workload-api';

interface IProps {
  distributionId: string;
  teacherEntryId: string;
  blockIds: string[];
  recordName?: string;
}

const RejectModal = ({ distributionId, teacherEntryId, blockIds, recordName }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const respond = useRespondWorkload();

  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const isReasonEmpty = reason.trim().length === 0;

  const handleReject = async () => {
    setTouched(true);
    if (isReasonEmpty) return;

    try {
      await respond.mutateAsync({
        distributionId,
        teacherEntryId,
        payload: { action: 'rejected', reason: reason.trim(), blockIds },
      });
      message.success(t('studyLoad.myWorkload.rejectSuccess'));
      hideModal();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <div style={{ padding: 'var(--space-4)' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {recordName !== undefined && recordName !== '' ? (
          <Alert
            type="warning"
            showIcon={false}
            message={
              <Typography.Text style={{ fontSize: 13 }}>
                <strong>{t('studyLoad.myWorkload.workloadLabel')}</strong> {recordName}
              </Typography.Text>
            }
            style={{ borderRadius: 'var(--radius-md)' }}
          />
        ) : null}

        <div>
          <Typography.Title level={5} style={{ marginBottom: 'var(--space-1)' }}>
            {t('studyLoad.myWorkload.rejectTitle')}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {t('studyLoad.myWorkload.rejectHint')}
          </Typography.Text>
        </div>

        <Form layout="vertical">
          <Form.Item
            label={t('studyLoad.common.rejectReason')}
            required
            validateStatus={touched && isReasonEmpty ? 'error' : ''}
            help={touched && isReasonEmpty ? t('studyLoad.common.rejectReasonRequired') : undefined}
          >
            <Input.TextArea
              rows={4}
              placeholder={t('studyLoad.myWorkload.rejectReasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              style={{ resize: 'none' }}
            />
          </Form.Item>
        </Form>

        <ModalFooter
          danger
          cancelLabel={t('studyLoad.common.cancel')}
          confirmLabel={t('studyLoad.approval.action.reject')}
          confirmIcon={<CloseCircleOutlined />}
          loading={respond.isPending}
          onConfirm={() => void handleReject()}
        />
      </Space>
    </div>
  );
};

export default RejectModal;
