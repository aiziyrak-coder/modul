import { useState } from 'react';
import { Button, Card, Descriptions, Flex, Input, Result, Space, Typography } from 'antd';
import { SafetyCertificateOutlined, EditOutlined } from '@ant-design/icons';
import { StatusTag } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { Protocol, ScientificWork } from '../model/types';
import { useGenerateProtocol, useSignProtocol } from '../api/science-council-api';

const { TextArea } = Input;
const { Text } = Typography;

interface ProtocolViewProps {
  work: ScientificWork;
  canSign?: boolean;
  canEdit?: boolean;
}

export function ProtocolView({ work, canSign, canEdit }: ProtocolViewProps) {
  const { t } = useTranslation();
  const generateMut = useGenerateProtocol();
  const signMut = useSignProtocol();

  const [conclusion, setConclusion] = useState('');
  const [editing, setEditing] = useState(false);

  const protocol: Protocol | undefined = work.protocol;

  if (!protocol && !canEdit) {
    return <Result status="info" title={t('scienceCouncil.noData')} />;
  }

  if (!protocol && canEdit) {
    return (
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>{t('scienceCouncil.protocol.finalConclusion')}</Text>
          <TextArea
            rows={6}
            value={conclusion}
            onChange={(e) => setConclusion(e.target.value)}
            maxLength={5000}
            showCount
          />
          <Button
            type="primary"
            loading={generateMut.isPending}
            disabled={!conclusion.trim()}
            onClick={() => generateMut.mutate({ workId: work.id, conclusion })}
          >
            {t('scienceCouncil.protocol.generate')}
          </Button>
        </Space>
      </Card>
    );
  }

  if (!protocol) return null;

  return (
    <Card>
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label={t('scienceCouncil.protocol.generate')}>
          {new Date(protocol.generatedAt).toLocaleDateString()}
        </Descriptions.Item>
        <Descriptions.Item label="E-IMZO">
          {protocol.eImzoSigned ? (
            <StatusTag label={protocol.eImzoCert ?? 'E-IMZO'} status="approved" />
          ) : (
            <StatusTag label={t('scienceCouncil.doc.notUploaded')} status="pending" />
          )}
        </Descriptions.Item>
        {protocol.signedAt && (
          <Descriptions.Item label={t('scienceCouncil.protocol.sign')}>
            {new Date(protocol.signedAt).toLocaleDateString()} — {protocol.signedBy}
          </Descriptions.Item>
        )}
      </Descriptions>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Text strong>{t('scienceCouncil.protocol.finalConclusion')}</Text>
        {editing && canEdit && !protocol.immutable ? (
          <TextArea
            rows={6}
            value={conclusion || protocol.finalConclusion}
            onChange={(e) => setConclusion(e.target.value)}
            style={{ marginTop: 'var(--space-2)' }}
          />
        ) : (
          <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-bg-elevate, #f5f5f5)', borderRadius: 'var(--radius-md)' }}>
            <Text>{protocol.finalConclusion}</Text>
          </div>
        )}
      </div>

      <Flex gap={8} style={{ marginTop: 'var(--space-4)' }}>
        {canEdit && !protocol.immutable && (
          <>
            {editing ? (
              <Button
                onClick={() => {
                  generateMut.mutate({ workId: work.id, conclusion: conclusion || protocol.finalConclusion });
                  setEditing(false);
                }}
                loading={generateMut.isPending}
              >
                {t('scienceCouncil.save')}
              </Button>
            ) : (
              <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
                {t('scienceCouncil.work.edit')}
              </Button>
            )}
          </>
        )}
        {canSign && !protocol.eImzoSigned && (
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            loading={signMut.isPending}
            onClick={() => signMut.mutate(work.id)}
          >
            {t('scienceCouncil.protocol.sign')}
          </Button>
        )}
      </Flex>
    </Card>
  );
}
