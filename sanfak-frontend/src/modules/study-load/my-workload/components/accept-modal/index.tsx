import { App, Alert, Form, Select, Typography, Space } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useRespondWorkload, getApiErrorMessage } from '../../api/my-workload-api';

interface IProps {
  distributionId: string;
  teacherEntryId: string;
  blockIds: string[];
  recordName?: string;
}

const AcceptModal = ({ distributionId, teacherEntryId, blockIds, recordName }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);
  const respond = useRespondWorkload();

  const handleAccept = async () => {
    try {
      await respond.mutateAsync({
        distributionId,
        teacherEntryId,
        payload: { action: 'accepted', blockIds },
      });
      message.success(t('studyLoad.myWorkload.acceptSuccess'));
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
            type="info"
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
            {t('studyLoad.myWorkload.acceptTitle')}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {t('studyLoad.myWorkload.acceptQuestion')}
          </Typography.Text>
        </div>

        <Form layout="vertical">
          <Form.Item
            label={t('studyLoad.common.eriKey')}
            extra={
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('studyLoad.common.eriComingSoon')}
              </Typography.Text>
            }
          >
            <Select
              placeholder={t('studyLoad.common.eriKeyPlaceholder')}
              disabled
              style={{ width: '100%' }}
              options={[]}
            />
          </Form.Item>
        </Form>

        <ModalFooter
          cancelLabel={t('studyLoad.common.cancel')}
          confirmLabel={t('studyLoad.common.accept')}
          confirmIcon={<CheckCircleOutlined />}
          loading={respond.isPending}
          onConfirm={() => void handleAccept()}
        />
      </Space>
    </div>
  );
};

export default AcceptModal;
