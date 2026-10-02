import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { App, Button, Card, Flex, Modal, Spin, Typography } from 'antd';
import { PageContainer } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { TEMPLATE_PLACEHOLDERS } from '../api/mock-data';
import { renderTemplateBody, downloadTemplateDoc } from '../lib/template-doc';
import { useTemplate, useSaveTemplate } from '../api/practice-api';

const { Text, Title } = Typography;
const LIST_PATH = '/amaliyot/shartnomalar';

const SHEET: React.CSSProperties = {
  width: '210mm',
  maxWidth: '100%',
  minHeight: '297mm',
  margin: '0 auto',
  padding: '20mm',
  background: '#fff',
  color: '#000',
  fontFamily: "'Times New Roman', serif",
  boxShadow: '0 1px 4px rgba(16,24,40,.10), 0 8px 24px rgba(16,24,40,.06)',
  borderRadius: 2,
};

export default function ShartnomaShablonPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { data, isLoading } = useTemplate();
  const save = useSaveTemplate();

  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const initial = useRef<string | null>(null);

  useEffect(() => {
    if (data && initial.current === null) {
      setBody(data.body);
      initial.current = data.body;
    }
  }, [data]);

  const isDirty = initial.current !== null && body !== initial.current;

  const insert = (ph: string) => {
    const token = `{{${ph}}}`;
    const el = ref.current;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    setBody((b) => b.slice(0, start) + token + b.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + token.length;
      el.selectionEnd = start + token.length;
    });
  };

  const onSave = useCallback(async () => {
    try {
      await save.mutateAsync(body);
      initial.current = body;
      message.success('Shablon saqlandi');
      setEditing(false);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  }, [body, message, save]);

  const leave = () => {
    if (isDirty) {
      setConfirmOpen(true);
      return;
    }
    navigate(LIST_PATH);
  };

  const html = useMemo(() => renderTemplateBody(body, true), [body]);

  if (isLoading) {
    return (
      <PageContainer title="Shartnoma shabloni">
        <Flex justify="center" style={{ padding: 48 }}>
          <Spin />
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Shartnoma shabloni">
      <Flex align="center" justify="space-between" wrap gap={12} style={{ marginBottom: 16 }}>
        <Flex align="center" gap={12}>
          <Button icon={<ArrowLeftOutlined />} onClick={leave}>
            Orqaga
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Shartnoma shabloni
          </Title>
        </Flex>
        <Flex gap={8} wrap>
          <Button
            icon={editing ? <EyeOutlined /> : <EditOutlined />}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Ko'rinish" : 'Tahrirlash'}
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => downloadTemplateDoc(body, 'shartnoma-shabloni')}
          >
            Yuklab olish
          </Button>
          <Button type="primary" onClick={onSave} loading={save.isPending} disabled={!isDirty}>
            Saqlash
          </Button>
        </Flex>
      </Flex>

      {editing && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            O'rin egallovchilarni tugma orqali qo'shing — generatsiyada real ma'lumot bilan
            to'ldiriladi.
          </Text>
          <Flex wrap gap={8} style={{ marginTop: 10 }}>
            {TEMPLATE_PLACEHOLDERS.map((ph) => (
              <Button key={ph} size="small" onClick={() => insert(ph)}>
                {`{{${ph}}}`}
              </Button>
            ))}
          </Flex>
        </Card>
      )}

      <div style={{ background: 'var(--color-bg-elevate, #f2f4f7)', padding: 24, borderRadius: 8 }}>
        {editing ? (
          <div style={SHEET}>
            <textarea
              ref={ref}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{
                width: '100%',
                minHeight: '250mm',
                border: 'none',
                outline: 'none',
                resize: 'vertical',
                padding: 0,
                background: 'transparent',
                color: '#000',
                fontFamily: "'Times New Roman', serif",
                fontSize: '12pt',
                lineHeight: 1.55,
              }}
            />
          </div>
        ) : (
          <div style={SHEET} dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>

      <Modal
        open={confirmOpen}
        title="O'zgarishlarni saqlaysizmi?"
        centered
        closable={false}
        maskClosable={false}
        onCancel={() => setConfirmOpen(false)}
        footer={[
          <Button key="stay" onClick={() => setConfirmOpen(false)}>
            Tahrirlashda qolish
          </Button>,
          <Button
            key="discard"
            danger
            onClick={() => {
              setConfirmOpen(false);
              setBody(initial.current ?? '');
              navigate(LIST_PATH);
            }}
          >
            Saqlamasdan chiqish
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={save.isPending}
            onClick={async () => {
              setConfirmOpen(false);
              await onSave();
              navigate(LIST_PATH);
            }}
          >
            Saqlash
          </Button>,
        ]}
      >
        <Text>Shablon matnida saqlanmagan o'zgarishlar bor.</Text>
      </Modal>
    </PageContainer>
  );
}
