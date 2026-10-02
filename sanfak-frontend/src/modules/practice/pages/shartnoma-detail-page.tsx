import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftOutlined, CheckOutlined, DownloadOutlined, EditOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Descriptions, Divider, Flex, Row, Spin, Tag, Timeline, Typography } from 'antd';
import dayjs from 'dayjs';
import { PageContainer } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { StatusTag } from '../components/status-tag';
import { EriModal } from '../components/eri-modal';
import { RejectModal } from '../components/reject-modal';
import type { Contract, EriKey, EriSignature } from '../model/types';
import { usePracticeRole } from '../model/view-role';
import { fillTemplate, downloadDoc } from '../lib/fill-template';
import {
  useContract,
  useTemplate,
  useSendToRector,
  useRectorSign,
  useOrgSign,
  useReject,
} from '../api/practice-api';

const { Title, Text, Paragraph } = Typography;
const fmtDate = (d?: string | null) => (d ? dayjs(d).format('DD.MM.YYYY') : '—');
const fmtDateTime = (d?: string | null) => (d ? dayjs(d).format('DD.MM.YYYY HH:mm') : '');

function SignatureCard({ title, sig }: { title: string; sig: EriSignature }) {
  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Flex justify="space-between" align="center">
        <Text strong>{title}</Text>
        {sig.signed ? <Tag color="green">Imzolangan</Tag> : <Tag color="default">Kutilmoqda</Tag>}
      </Flex>
      {sig.signed && (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-soft, #697586)' }}>
          <div>Imzolovchi: {sig.signer ?? '—'}</div>
          <div>Sana: {fmtDateTime(sig.signedAt)}</div>
          {sig.certInfo?.serialNumber && <div>ERI seriya: {sig.certInfo.serialNumber}</div>}
        </div>
      )}
    </Card>
  );
}

export default function ShartnomaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const role = usePracticeRole();
  const isDept = role === 'amaliyot_bolimi';

  const { data: contract, isLoading } = useContract(id);
  const { data: template } = useTemplate();
  const sendToRector = useSendToRector();
  const rectorSign = useRectorSign();
  const orgSign = useOrgSign();
  const rejectMut = useReject();

  const [eriOpen, setEriOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  if (isLoading) {
    return (
      <PageContainer title="Shartnoma">
        <Flex justify="center" style={{ padding: 60 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }
  if (!contract) {
    return (
      <PageContainer title="Shartnoma">
        <Text>Shartnoma topilmadi.</Text>
      </PageContainer>
    );
  }

  const c: Contract = contract;
  const previewText = template ? fillTemplate(template.body, c) : '';

  const guard = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      message.success(ok);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handleSend = () =>
    modal.confirm({
      title: 'Rektorga yuborish',
      content: `"${c.number}" rektorga tasdiqlashga yuborilsinmi?`,
      okText: 'Yuborish',
      cancelText: 'Bekor qilish',
      centered: true,
      onOk: () => guard(() => sendToRector.mutateAsync(c.id), 'Rektorga yuborildi'),
    });

  const onEriConfirm = async (cert: EriKey) => {
    const fn = role === 'rektor' ? rectorSign : orgSign;
    await guard(() => fn.mutateAsync({ id: c.id, cert }), 'Imzolandi');
    setEriOpen(false);
  };
  const onRejectConfirm = async (reason: string) => {
    const rejectedBy = role === 'rektor' ? 'rektor' : 'org_head';
    await guard(() => rejectMut.mutateAsync({ id: c.id, reason, rejectedBy }), 'Rad etildi');
    setRejectOpen(false);
  };

  const pending = role === 'rektor' ? 'in_progress' : 'rektor_approved';
  const canReview = !isDept && c.status === pending;

  return (
    <PageContainer title={`Shartnoma ${c.number}`}>
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 16 }}>
        <Flex align="center" gap={12}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/amaliyot/shartnomalar')}>
            Orqaga
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {c.number}
          </Title>
          <StatusTag status={c.status} role={role} />
        </Flex>
        <Flex gap={8} wrap>
          {isDept && c.status === 'draft' && (
            <Button type="primary" icon={<SendOutlined />} onClick={handleSend}>
              Rektorga yuborish
            </Button>
          )}
          {isDept && (c.status === 'draft' || c.status === 'rejected') && (
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/amaliyot/shartnomalar/${c.id}/tahrirlash`)}
            >
              Tahrirlash
            </Button>
          )}
          {canReview && (
            <>
              <Button type="primary" icon={<CheckOutlined />} onClick={() => setEriOpen(true)}>
                Tasdiqlash (ERI)
              </Button>
              <Button danger icon={<StopOutlined />} onClick={() => setRejectOpen(true)}>
                Rad etish
              </Button>
            </>
          )}
          <Button icon={<DownloadOutlined />} onClick={() => downloadDoc(previewText, c.number)}>
            Shartnomani shablon asosida yuklab olish
          </Button>
        </Flex>
      </Flex>

      {c.status === 'rejected' && c.rejectReason && (
        <Card size="small" style={{ marginBottom: 16, borderColor: 'var(--brand-error, #f04438)' }}>
          <Text type="danger" strong>
            Rad etildi:
          </Text>{' '}
          {c.rejectReason}
        </Card>
      )}

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="Umumiy ma'lumotlar" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Shartnoma raqami">{c.number}</Descriptions.Item>
              <Descriptions.Item label="Amaliyot bazasi">{c.organization.title}</Descriptions.Item>
              <Descriptions.Item label="Hudud">
                {c.organization.region.title}, {c.organization.district.title}
              </Descriptions.Item>
              <Descriptions.Item label="Yo'nalish">{c.direction.title}</Descriptions.Item>
              <Descriptions.Item label="O'quv yili">{c.academicYear.title}</Descriptions.Item>
              <Descriptions.Item label="Kurs / Guruh">
                {c.course ?? '—'} / {c.group ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Muddat">
                {fmtDate(c.startDate)} — {fmtDate(c.endDate)}
              </Descriptions.Item>
              <Descriptions.Item label="Izoh">{c.note ?? '—'}</Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '12px 0' }} />
            <Text strong>Biriktirilgan talabalar ({c.studentsCount})</Text>
            <ul style={{ marginTop: 8 }}>
              {c.students.map((s) => (
                <li key={s.id}>
                  {s.fish} {s.group ? `(${s.group})` : ''}
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Shablon asosidagi matn" size="small">
            <Paragraph
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: 12.5,
                maxHeight: 320,
                overflowY: 'auto',
                background: 'var(--color-bg-elevate, #fafbfc)',
                padding: 12,
                borderRadius: 8,
              }}
            >
              {previewText}
            </Paragraph>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="ERI tasdiqlash holati" size="small" style={{ marginBottom: 16 }}>
            <SignatureCard title="Rektor" sig={c.rector} />
            <SignatureCard title="Tibbiyot birlashmasi rahbari" sig={c.orgHead} />
          </Card>

          <Card title="Harakatlar tarixi" size="small">
            <Timeline
              items={c.history.map((h) => ({
                children: (
                  <div>
                    <Text strong>{h.action}</Text>
                    <div style={{ fontSize: 12, color: 'var(--color-text-soft, #697586)' }}>
                      {h.actor} · {fmtDateTime(h.at)}
                    </div>
                    {h.reason && <div style={{ fontSize: 12, color: 'var(--brand-error, #f04438)' }}>Sabab: {h.reason}</div>}
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>

      <EriModal open={eriOpen} onCancel={() => setEriOpen(false)} onConfirm={onEriConfirm} loading={rectorSign.isPending || orgSign.isPending} />
      <RejectModal open={rejectOpen} onCancel={() => setRejectOpen(false)} onConfirm={onRejectConfirm} loading={rejectMut.isPending} />
    </PageContainer>
  );
}
