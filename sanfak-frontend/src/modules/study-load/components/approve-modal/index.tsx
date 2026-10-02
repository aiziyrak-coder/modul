import { useEffect, useRef, useState } from 'react';
import { App, Col, Form, Input, Row, Select, Spin, Typography } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';
import { ModalFooter, useModalStore } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';

const SUCCESS_HOLD_MS = 1400;

interface IProps {
  title: string;
  onConfirm: (protocol?: string) => Promise<void>;
  loading?: boolean;
  recordName?: string;
  protocol?: boolean;
}

const PROTOCOL_RX = /^[0-9]+(?:[/-][0-9A-Za-z]+)?$/;

const ApproveModal = ({ title, onConfirm, loading = false, recordName, protocol = false }: IProps) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const hideModal = useModalStore((s) => s.hideModal);

  const [protocolValue, setProtocolValue] = useState('');
  const [protocolTouched, setProtocolTouched] = useState(false);
  const [done, setDone] = useState(false);
  const isProtocolEmpty = protocolValue.trim().length === 0;
  const isProtocolInvalid = !isProtocolEmpty && !PROTOCOL_RX.test(protocolValue.trim());
  const protocolStatus = protocolTouched && (isProtocolEmpty || isProtocolInvalid) ? 'error' : '';
  const protocolHelp = !protocolTouched
    ? undefined
    : isProtocolEmpty
      ? t('studyLoad.common.protocolRequired')
      : isProtocolInvalid
        ? t('studyLoad.common.protocolInvalid')
        : undefined;

  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const handleConfirm = async () => {
    if (protocol) {
      setProtocolTouched(true);
      if (isProtocolEmpty || isProtocolInvalid) return;
    }

    try {
      await onConfirm(protocol ? protocolValue.trim() : undefined);
      message.success(t('studyLoad.common.approved', { defaultValue: 'Tasdiqlandi' }));
      setDone(true);
      timerRef.current = window.setTimeout(() => hideModal(), SUCCESS_HOLD_MS);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      const text =
        err?.response?.data?.message ?? err?.message ?? t('studyLoad.common.errorOccurred');
      message.error(text);
    }
  };

  if (done) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)',
          padding: 'var(--space-6)',
        }}
      >
        <CheckCircleFilled style={{ fontSize: 48, color: 'var(--brand-primary)' }} />
        <Typography.Text strong style={{ fontSize: 16 }}>
          {t('studyLoad.common.approved', { defaultValue: 'Tasdiqlandi' })}
        </Typography.Text>
      </div>
    );
  }

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

        {protocol ? (
          <Col span={24}>
            <Form layout="vertical">
              <Form.Item
                label={t('studyLoad.common.protocol')}
                required
                validateStatus={protocolStatus}
                help={protocolHelp}
              >
                <Input
                  maxLength={20}
                  placeholder={t('studyLoad.common.protocolPlaceholder')}
                  value={protocolValue}
                  onChange={(e) => setProtocolValue(e.target.value)}
                  onBlur={() => setProtocolTouched(true)}
                />
              </Form.Item>
            </Form>
          </Col>
        ) : null}

        <Col span={24}>
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
                options={[{ value: '1', label: 'Eri' }]}
              />
            </Form.Item>
          </Form>
        </Col>

        <Col span={24}>
          <ModalFooter
            spacing="none"
            cancelLabel={t('studyLoad.common.cancel')}
            confirmLabel={t('studyLoad.common.accept')}
            loading={loading}
            onConfirm={() => void handleConfirm()}
          />
        </Col>
      </Row>
    </div>
  );
};

export default ApproveModal;
