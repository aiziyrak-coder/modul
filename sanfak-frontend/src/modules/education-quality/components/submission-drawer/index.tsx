import { useState, useEffect, useMemo } from 'react';
import { Drawer, Button, Input, InputNumber, Modal, Tag } from 'antd';
import {
  FilePdfOutlined, CheckOutlined, CloseOutlined,
  ExclamationCircleFilled, LinkOutlined,
} from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import type { TFunction } from 'i18next';
import type { Submission, DataField } from '../../model/types';
import { useIndicator, useReviewSubmission } from '../../api/education-quality-api';
import * as S from './style';

const { TextArea } = Input;

interface Props {
  open: boolean;
  submission: Submission | null;
  onClose: () => void;
  readOnly?: boolean;
  onActionDone?: () => void;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatMoney(t: TFunction, val: unknown): string {
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return t('educationQuality.drawer.moneyValue', { amount: n.toLocaleString('uz-UZ') });
}

function renderFile(t: TFunction, raw: unknown): React.ReactNode {
  const item = Array.isArray(raw) ? raw[0] : raw;
  const obj = item && typeof item === 'object' ? (item as { fileUrl?: string; fileName?: string }) : null;
  const name = obj?.fileName ?? (typeof item === 'string' ? item : '') ?? '';
  const tag = (
    <Tag icon={<FilePdfOutlined />} color="red" style={{ cursor: obj?.fileUrl ? 'pointer' : 'default' }}>
      {name || t('educationQuality.drawer.pdfFile')}
    </Tag>
  );
  if (!obj?.fileUrl) return tag;
  return (
    <a href={obj.fileUrl} target="_blank" rel="noreferrer">
      {tag}
    </a>
  );
}

function renderValue(t: TFunction, field: DataField | undefined, raw: unknown): React.ReactNode {
  if (raw == null || raw === '') return '—';
  switch (field?.type) {
    case 'money':
      return formatMoney(t, raw);
    case 'date':
      return formatDate(String(raw));
    case 'file':
      return renderFile(t, raw);
    case 'select':
      return t(`educationQuality.fieldOption.${String(raw).toLowerCase()}`, {
        defaultValue: String(raw),
      });
    case 'url':
      return (
        <a
          href={String(raw)}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: 'var(--ant-color-link, #1677ff)', fontWeight: 600,
            textDecoration: 'underline',
          }}
        >
          <LinkOutlined />
          {t('educationQuality.drawer.openLink')}
        </a>
      );
    default:
      return String(raw);
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function SubmissionDrawer({ open, submission, onClose, readOnly, onActionDone }: Props) {
  const { t } = useTranslation();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coeff, setCoeff] = useState(1);

  const { data: indicator } = useIndicator(submission?.indicator._id);
  const reviewMut = useReviewSubmission();

  useEffect(() => {
    if (!submission) return;
    const def = round2(submission.authorShare / 100);
    setCoeff(def);
  }, [submission]);

  const isPending = submission?.status === 'pending';
  const isRejected = submission?.status === 'rejected';
  const isApproved = submission?.status === 'approved';
  const editableCoeff = isPending && !readOnly;

  const computedBall = useMemo(() => {
    if (!indicator) return 0;
    return round2(indicator.coefficient * coeff);
  }, [indicator, coeff]);

  const authorCount = useMemo(() => {
    if (!submission) return 1;
    return Math.max(1, Math.round(100 / submission.authorShare));
  }, [submission]);

  const statusLabel = isPending
    ? t('educationQuality.status.new')
    : isApproved
      ? t('educationQuality.status.approved')
      : t('educationQuality.status.rejected');
  const statusColor = isPending ? 'processing' : isApproved ? 'success' : 'error';

  const doApprove = () => {
    if (!submission) return;
    reviewMut.mutate(
      { id: submission._id, review: { status: 'approved', score: computedBall } },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          onClose();
          onActionDone?.();
        },
      },
    );
  };

  const doReject = () => {
    if (!submission || !reason.trim()) return;
    reviewMut.mutate(
      { id: submission._id, review: { status: 'rejected', comment: reason.trim() } },
      {
        onSuccess: () => {
          setRejectOpen(false);
          setReason('');
          onClose();
          onActionDone?.();
        },
      },
    );
  };

  if (!submission) return null;

  const teacher = submission.teacher;
  const fullName = `${teacher.lastName} ${teacher.firstName}${teacher.middleName ? ` ${teacher.middleName}` : ''}`;

  return (
    <Drawer
      title={t('educationQuality.drawer.title')}
      width={560}
      open={open}
      onClose={onClose}
      destroyOnHidden
      footer={
        !readOnly && isPending ? (
          <S.DrawerFooter>
            <Button danger icon={<CloseOutlined />} onClick={() => { setReason(''); setRejectOpen(true); }}>
              {t('educationQuality.drawer.reject')}
            </Button>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => setConfirmOpen(true)}>
              {t('educationQuality.drawer.approve')}
            </Button>
          </S.DrawerFooter>
        ) : null
      }
    >
      <S.Head>
        <strong>{fullName}</strong>
        <span>{teacher.department?.title} · {teacher.position?.title}</span>
      </S.Head>

      <S.Row>
        <S.Label>{t('educationQuality.common.indicator')}</S.Label>
        <S.Val>{submission.indicator.title}</S.Val>
      </S.Row>
      <S.Row>
        <S.Label>{t('educationQuality.common.status')}</S.Label>
        <S.Val>
          <Tag color={statusColor}>{statusLabel}</Tag>
        </S.Val>
      </S.Row>
      <S.Row>
        <S.Label>{t('educationQuality.drawer.submittedAt')}</S.Label>
        <S.Val>{formatDateTime(submission.createdAt)}</S.Val>
      </S.Row>
      <S.Row>
        <S.Label>{t('educationQuality.drawer.indicatorScore')}</S.Label>
        <S.Val>{t('educationQuality.drawer.points', { score: submission.indicator.coefficient })}</S.Val>
      </S.Row>
      <S.Row>
        <S.Label>{t('educationQuality.drawer.authorCount')}</S.Label>
        <S.Val>{authorCount}</S.Val>
      </S.Row>

      <div style={{ margin: '20px 0 8px', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: 'var(--color-text-tertiary, #475467)', letterSpacing: 0.4 }}>
        {t('educationQuality.drawer.submittedData')}
      </div>

      {(indicator?.dataFields ?? []).map((f) => (
        <S.Row key={f.key}>
          <S.Label>{t(`educationQuality.field.${f.key}`, { defaultValue: f.label })}</S.Label>
          <S.Val>{renderValue(t, f, (submission.data as Record<string, unknown>)?.[f.key])}</S.Val>
        </S.Row>
      ))}

      <S.Row>
        <S.Label>
          {t('educationQuality.drawer.coefficient')}
          {editableCoeff && (
            <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-quaternary, #98A2B3)' }}>
              {t('educationQuality.drawer.coeffDefault', { count: authorCount })}
            </span>
          )}
        </S.Label>
        <S.Val>
          {editableCoeff ? (
            <InputNumber
              min={0}
              max={1}
              step={0.05}
              value={coeff}
              onChange={(v) => setCoeff(v ?? 0)}
              style={{ width: 110 }}
            />
          ) : (
            round2(submission.authorShare / 100)
          )}
        </S.Val>
      </S.Row>

      {isApproved && (
        <S.PointsBox>
          <div className="pts">{t('educationQuality.drawer.points', { score: submission.score })}</div>
          <div className="lbl">
            {t('educationQuality.drawer.scoreFormula', {
              base: submission.indicator.coefficient,
              coeff: round2(submission.authorShare / 100),
            })}
          </div>
        </S.PointsBox>
      )}

      {isRejected && submission.comment && (
        <div style={{
          marginTop: 16,
          background: 'var(--color-error-bg, #fff2f0)',
          border: '1px solid var(--color-error-border, #ffccc7)',
          borderRadius: 'var(--radius-md, 8px)',
          padding: 16,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--brand-error, #F04438)', marginBottom: 4 }}>
            {t('educationQuality.drawer.rejectReason')}
          </div>
          <div style={{ color: 'var(--color-text-secondary, #475467)' }}>{submission.comment}</div>
        </div>
      )}

      {editableCoeff && (
        <S.PointsBox>
          <div className="pts">~{t('educationQuality.drawer.points', { score: computedBall })}</div>
          <div className="lbl">
            {t('educationQuality.drawer.estimatedNote', {
              base: submission.indicator.coefficient,
              coeff,
            })}
          </div>
        </S.PointsBox>
      )}

      <Modal
        open={confirmOpen}
        title={t('educationQuality.drawer.confirmTitle')}
        onCancel={() => setConfirmOpen(false)}
        onOk={doApprove}
        okText={t('educationQuality.drawer.approve')}
        cancelText={t('educationQuality.common.cancel')}
        confirmLoading={reviewMut.isPending}
        centered
      >
        <div style={{ display: 'flex', gap: 14, fontSize: 14, lineHeight: 1.7 }}>
          <ExclamationCircleFilled style={{ color: 'var(--brand-primary, #16B364)', fontSize: 22, marginTop: 2 }} />
          <div>
            <div>{t('educationQuality.drawer.submittedBy')}: <b>{fullName}</b></div>
            <div style={{ color: 'var(--color-text-tertiary, #667085)' }}>{submission.indicator.title}</div>
            <div style={{ marginTop: 8 }}>
              {t('educationQuality.drawer.scoreOnApproval')}:{' '}
              <b style={{ color: 'var(--brand-primary, #0B843F)' }}>
                {t('educationQuality.drawer.points', { score: computedBall })}
              </b>{' '}
              ({t('educationQuality.drawer.coefficientValue', { coeff })})
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={rejectOpen}
        title={
          <span>
            <ExclamationCircleFilled style={{ color: 'var(--brand-error, #F04438)', marginRight: 8 }} />
            {t('educationQuality.drawer.rejectTitle')}
          </span>
        }
        onCancel={() => setRejectOpen(false)}
        onOk={doReject}
        okText={t('educationQuality.drawer.reject')}
        cancelText={t('educationQuality.common.cancel')}
        okButtonProps={{ danger: true, disabled: !reason.trim() }}
        confirmLoading={reviewMut.isPending}
        centered
      >
        <p style={{ color: 'var(--color-text-secondary, #475467)' }}>
          {t('educationQuality.drawer.rejectHint')}
        </p>
        <TextArea
          rows={4}
          value={reason}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
          placeholder={t('educationQuality.drawer.rejectPlaceholder')}
        />
      </Modal>
    </Drawer>
  );
}
