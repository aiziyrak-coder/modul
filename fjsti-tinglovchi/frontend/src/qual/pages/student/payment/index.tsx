import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeftOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CreditCardOutlined,
  InboxOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { App, Button, Empty, InputNumber, Spin, Typography, Upload } from 'antd';
import dayjs from 'dayjs';
import { PageContainer, Card, Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { getApiErrorMessage } from '@/shared/api';
import { useMyCourses } from '../../../api/my-course-api';
import { useMyContracts } from '../../../api/contract-api';
import { useMyPayment, useSubmitBankPayment } from '../../../api/payment-api';
import { useSessionStore } from '@/app/session';
import OfferAgreement, { type OfferData } from '../../../components/offer-agreement';
import type { MyCourse } from '../../../model/my-course.types';
import type { PaymentMethod, PaymentSummary, PaymentTransaction } from '../../../model/payment.types';

const { Text, Title } = Typography;

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
const fmtDateTime = (s?: string | null) => (s ? dayjs(s).format('DD.MM.YYYY HH:mm') : '—');
const fmtSum = (n: number) => `${(n || 0).toLocaleString('ru-RU')} so'm`;

function GraduationCapIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  );
}
function Badge({ tone, children }: { tone: 'info' | 'warn'; children: React.ReactNode }) {
  const map = {
    info: { bg: 'color-mix(in srgb, var(--brand-info) 12%, #fff)', fg: 'var(--brand-info)' },
    warn: { bg: 'color-mix(in srgb, var(--brand-warning) 16%, #fff)', fg: '#a16207' },
  }[tone];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 10px', borderRadius: 'var(--radius-pill)', fontSize: 12, fontWeight: 500, background: map.bg, color: map.fg }}>
      {children}
    </span>
  );
}
function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-text-mute)' }}>
      {icon}
      {children}
    </span>
  );
}

export default function StudentPaymentPage() {
  const { t } = useTranslation();
  const { data: courses = [], isLoading } = useMyCourses();
  const [searchParams, setSearchParams] = useSearchParams();
  const courseId = searchParams.get('course');
  const selected = courses.find((c) => c.id === courseId) ?? null;

  return (
    <PageContainer title={t('qualification.payment.nav')}>
      {selected ? (
        <CoursePaymentDetail course={selected} onBack={() => setSearchParams({})} />
      ) : (
        <CourseList courses={courses} loading={isLoading} onOpen={(c) => setSearchParams({ course: c.id })} />
      )}
      <div aria-hidden style={{ height: 'var(--space-8, 40px)', flexShrink: 0 }} />
    </PageContainer>
  );
}

function CourseList({ courses, loading, onOpen }: { courses: MyCourse[]; loading: boolean; onOpen: (c: MyCourse) => void }) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: 240 }}>
        <Spin />
      </Flex>
    );
  }
  return (
    <>
      <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '14px 16px' } }}>
        <Text strong style={{ fontSize: 14 }}>{t('qualification.payment.selectCourse')}</Text>
        <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 2 }}>{t('qualification.payment.selectCourseHint')}</div>
      </Card>

      {courses.length === 0 ? (
        <Card size="small">
          <Flex vertical align="center" justify="center" gap={12} style={{ padding: '56px 16px' }}>
            <span style={{ color: 'var(--color-text-mute)' }}><GraduationCapIcon size={44} /></span>
            <Text type="secondary">{t('qualification.payment.noCourses')}</Text>
          </Flex>
        </Card>
      ) : (
        <>
          <style>{`
            .ql-pay-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
            @media (min-width: 640px) { .ql-pay-grid { grid-template-columns: 1fr 1fr; } }
          `}</style>
          <div className="ql-pay-grid">
            {courses.map((c) => (
              <CourseCard key={c.id} course={c} onClick={() => onOpen(c)} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function CourseCard({ course, onClick }: { course: MyCourse; onClick: () => void }) {
  const { t } = useTranslation();
  const online = course.form === 1;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ textAlign: 'left', cursor: 'pointer', background: 'var(--color-bg)', border: '1px solid var(--color-border-soft)', borderRadius: 'var(--radius-lg)', padding: 20, display: 'flex', gap: 16, alignItems: 'flex-start', boxShadow: 'var(--shadow-sm)' }}
    >
      <span style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 'var(--radius-lg)', background: 'var(--brand-primary-soft)', color: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <GraduationCapIcon size={24} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text strong style={{ fontSize: 14, lineHeight: 1.35, display: 'block' }} ellipsis={{ tooltip: course.title }}>
          {course.title}
        </Text>
        <Flex wrap gap={8} align="center" style={{ marginTop: 10 }}>
          <Badge tone={online ? 'info' : 'warn'}>{online ? t('qualification.payment.online') : t('qualification.payment.offline')}</Badge>
          <Meta icon={<ClockCircleOutlined />}>{t('qualification.payment.hours', { h: course.creditHours })}</Meta>
          <Meta icon={<CalendarOutlined />}>{fmtDate(course.startDate)} — {fmtDate(course.endDate)}</Meta>
          {course.paid ? (
            <CheckCircleFilled
              title={t('qualification.payment.statusConfirmed')}
              style={{ color: 'var(--brand-primary)', fontSize: 18, marginLeft: 'auto' }}
            />
          ) : null}
        </Flex>
      </div>
      <RightOutlined style={{ fontSize: 14, color: 'var(--color-text-mute)', marginTop: 4 }} />
    </button>
  );
}

function CoursePaymentDetail({ course, onBack }: { course: MyCourse; onBack: () => void }) {
  const { t } = useTranslation();
  const { data: payment, isLoading } = useMyPayment(course.id);
  const user = useSessionStore((s) => s.user);
  const { data: contracts = [] } = useMyContracts();
  const contract = contracts.find((c) => c.courseTitle === course.title);
  const [accepted, setAccepted] = useState(false);

  const offerData: OfferData = {
    listenerName: user?.fullName ?? '—',
    passport: user?.passport,
    courseTitle: course.title,
    courseType: contract?.courseType,
    form: course.form,
    creditHours: course.creditHours,
    startDate: course.startDate,
    endDate: course.endDate,
    price: contract?.totalPrice || course.price,
    contractDate: contract?.createdAt,
  };

  const pendingAmount = (payment?.transactions ?? [])
    .filter((tx) => tx.status === 1)
    .reduce((s, tx) => s + tx.amount, 0);
  const submittable = payment ? Math.max(0, payment.remainingAmount - pendingAmount) : 0;

  return (
    <Flex vertical gap={16} style={{ maxWidth: 860, width: '100%', margin: '0 auto' }}>
      <Flex align="center" gap={10}>
        <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ paddingLeft: 4 }}>
          {t('qualification.payment.back')}
        </Button>
        <Text type="secondary">/</Text>
        <Text strong ellipsis={{ tooltip: course.title }} style={{ maxWidth: 360 }}>{course.title}</Text>
      </Flex>

      {isLoading ? (
        <Flex align="center" justify="center" style={{ minHeight: 200 }}><Spin /></Flex>
      ) : !payment ? (
        <Card size="small">
          <Flex align="center" justify="center" style={{ minHeight: 160 }}>
            <Empty description={t('qualification.payment.notFound')} />
          </Flex>
        </Card>
      ) : (
        <>
          <SummaryCard payment={payment} online={course.form === 1} />
          {payment.remainingAmount > 0 ? (
            <MethodSection
              course={course.id}
              submittable={submittable}
              offerData={offerData}
              accepted={accepted}
              onAcceptedChange={setAccepted}
            />
          ) : null}
          <HistoryCard transactions={payment.transactions} />
        </>
      )}
    </Flex>
  );
}

function SummaryCard({ payment, online }: { payment: PaymentSummary; online: boolean }) {
  const { t } = useTranslation();
  const fullyPaid = payment.remainingAmount <= 0;
  return (
    <Card size="small" styles={{ body: { padding: 20 } }}>
      <Flex align="flex-start" justify="space-between" gap={12} style={{ marginBottom: 18 }}>
        <div style={{ minWidth: 0 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>{t('qualification.payment.status')}</Text>
          <Title level={5} style={{ margin: '2px 0 0' }}>
            {payment.courseName}
            <span style={{ fontWeight: 500, color: online ? 'var(--brand-info)' : '#a16207' }}>
              {', '}{online ? t('qualification.payment.online') : t('qualification.payment.offline')}
            </span>
          </Title>
        </div>
        {fullyPaid ? (
          <Flex align="center" gap={6} style={{ color: 'var(--brand-primary)', flexShrink: 0 }}>
            <CheckCircleFilled />
            <Text strong style={{ color: 'var(--brand-primary)', fontSize: 13, whiteSpace: 'nowrap' }}>{t('qualification.payment.fullyPaid')}</Text>
          </Flex>
        ) : null}
      </Flex>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <SumCell label={t('qualification.payment.total')} value={fmtSum(payment.totalAmount)} color="var(--color-text)" />
        <SumCell label={t('qualification.payment.paid')} value={fmtSum(payment.paidAmount)} color="var(--brand-primary)" />
        <SumCell label={t('qualification.payment.remaining')} value={fmtSum(payment.remainingAmount)} color={fullyPaid ? 'var(--color-text-mute)' : 'var(--brand-error)'} />
      </div>
    </Card>
  );
}
function SumCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevate)' }}>
      <div style={{ fontSize: 12, color: 'var(--color-text-soft)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function MethodSection({
  course,
  submittable,
  offerData,
  accepted,
  onAcceptedChange,
}: {
  course: string;
  submittable: number;
  offerData: OfferData;
  accepted: boolean;
  onAcceptedChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const [method, setMethod] = useState<PaymentMethod>(3);

  const methods: { id: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { id: 3, label: t('qualification.payment.methodBank'), icon: <BankOutlined style={{ color: 'var(--color-text-soft)' }} /> },
    { id: 1, label: t('qualification.payment.methodClick'), icon: <CreditCardOutlined style={{ color: 'var(--brand-info)' }} /> },
    { id: 2, label: t('qualification.payment.methodPayme'), icon: <CreditCardOutlined style={{ color: '#3b5bdb' }} /> },
  ];

  return (
    <Card size="small" styles={{ body: { padding: 20 } }}>
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 14 }}>{t('qualification.payment.method')}</Text>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {methods.map((m) => {
          const on = m.id === method;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, borderRadius: 'var(--radius-lg)', cursor: 'pointer', border: `1.5px solid ${on ? 'var(--brand-primary)' : 'var(--color-border)'}`, background: on ? 'var(--brand-primary-soft)' : 'var(--color-bg)', fontSize: 20 }}
            >
              {m.icon}
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{m.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 18 }}>
        {method === 3 ? (
          <BankForm
            course={course}
            maxAmount={submittable}
            offerData={offerData}
            accepted={accepted}
            onAcceptedChange={onAcceptedChange}
          />
        ) : (
          <Flex vertical align="center" gap={10} style={{ padding: '28px 16px', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-elevate)' }}>
            <CreditCardOutlined style={{ fontSize: 34, color: 'var(--brand-info)' }} />
            <Text strong>{method === 1 ? t('qualification.payment.clickPlaceholder') : t('qualification.payment.paymePlaceholder')}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{t('qualification.payment.sdkHint')}</Text>
          </Flex>
        )}
      </div>
    </Card>
  );
}

function BankForm({
  course,
  maxAmount,
  offerData,
  accepted,
  onAcceptedChange,
}: {
  course: string;
  maxAmount: number;
  offerData: OfferData;
  accepted: boolean;
  onAcceptedChange: (v: boolean) => void;
}) {
  const locked = !accepted;
  const { t } = useTranslation();
  const { message } = App.useApp();
  const submit = useSubmitBankPayment();
  const [amount, setAmount] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);

  const onSubmit = () => {
    if (!amount || amount < 1000) { message.error(t('qualification.payment.amountRequired')); return; }
    if (amount > maxAmount) { message.error(t('qualification.payment.amountTooBig')); return; }
    if (!file) { message.error(t('qualification.payment.receiptRequired')); return; }
    submit.mutate(
      { course, amount, file },
      {
        onSuccess: () => {
          setSuccess(true);
          setAmount(null);
          setFile(null);
          message.success(t('qualification.payment.submitSuccess'));
        },
        onError: (e) => message.error(getApiErrorMessage(e) || t('qualification.payment.errorGeneric')),
      },
    );
  };

  if (maxAmount <= 0) {
    return (
      <Flex
        align="center"
        gap={8}
        style={{
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'color-mix(in srgb, var(--brand-warning) 12%, #fff)',
          border: '1px solid color-mix(in srgb, var(--brand-warning) 30%, #fff)',
        }}
      >
        <ClockCircleOutlined style={{ color: '#a16207', flexShrink: 0 }} />
        <Text style={{ fontSize: 13, color: '#a16207' }}>
          {t('qualification.payment.pendingBlocked')}
        </Text>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={14}>
      {success ? (
        <Flex align="center" gap={8} style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--brand-primary-soft)', border: '1px solid color-mix(in srgb, var(--brand-primary) 30%, #fff)' }}>
          <CheckCircleFilled style={{ color: 'var(--brand-primary)' }} />
          <Text style={{ fontSize: 13, color: 'var(--brand-primary)' }}>{t('qualification.payment.submitSuccess')}</Text>
        </Flex>
      ) : null}

      <div>
        <Text style={{ fontSize: 13, color: 'var(--color-text-soft)', display: 'block', marginBottom: 6 }}>{t('qualification.payment.amount')}</Text>
        <InputNumber
          value={amount}
          onChange={(v) => {
            setAmount(typeof v === 'number' ? Math.min(v, maxAmount) : v);
            setSuccess(false);
          }}
          min={1000}
          max={maxAmount}
          style={{ width: '100%' }}
          placeholder={t('qualification.payment.amountPh')}
          formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
          parser={(v) => Number((v ?? '').replace(/\s/g, ''))}
        />
        <div style={{ fontSize: 12, color: 'var(--color-text-mute)', marginTop: 4 }}>{t('qualification.payment.maxAmount', { sum: fmtSum(maxAmount) })}</div>
      </div>

      <div>
        <Text style={{ fontSize: 13, color: 'var(--color-text-soft)', display: 'block', marginBottom: 6 }}>{t('qualification.payment.receipt')}</Text>
        <Upload.Dragger
          accept=".pdf,.jpg,.jpeg"
          maxCount={1}
          multiple={false}
          beforeUpload={(f) => { setFile(f); setSuccess(false); return false; }}
          onRemove={() => setFile(null)}
          fileList={file ? [{ uid: '1', name: file.name } as never] : []}
        >
          <p style={{ margin: 0, color: 'var(--brand-primary)', fontSize: 28 }}><InboxOutlined /></p>
          <p style={{ margin: '6px 0 0', fontSize: 13 }}>{t('qualification.payment.dragHint')}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-mute)' }}>{t('qualification.payment.receiptHint')}</p>
        </Upload.Dragger>
      </div>

      <Flex justify="space-between" align="center" gap={12} wrap>
        <OfferAgreement data={offerData} accepted={accepted} onAcceptedChange={onAcceptedChange} />
        <Button type="primary" loading={submit.isPending} disabled={locked} onClick={onSubmit}>
          {t('qualification.payment.submit')}
        </Button>
      </Flex>
    </Flex>
  );
}

const METHOD_KEY: Record<PaymentMethod, string> = { 1: 'methodClick', 2: 'methodPayme', 3: 'methodBank' };
const STATUS_STYLE: Record<PaymentStatusKey, { key: string; bg: string; fg: string }> = {
  1: { key: 'statusPending', bg: 'color-mix(in srgb, var(--brand-warning) 16%, #fff)', fg: '#a16207' },
  2: { key: 'statusConfirmed', bg: 'var(--brand-primary-soft)', fg: 'var(--brand-primary)' },
  3: { key: 'statusRejected', bg: 'color-mix(in srgb, var(--brand-error) 12%, #fff)', fg: 'var(--brand-error)' },
};
type PaymentStatusKey = 1 | 2 | 3;

function HistoryCard({ transactions }: { transactions: PaymentTransaction[] }) {
  const { t } = useTranslation();
  const fmt = (n: number) => (n || 0).toLocaleString('ru-RU');
  const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-text-mute)' };
  const td: React.CSSProperties = { padding: '12px', fontSize: 13, borderTop: '1px solid var(--color-border-soft)' };

  return (
    <Card size="small" styles={{ body: { padding: 20 } }}>
      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 14 }}>{t('qualification.payment.history')}</Text>
      {transactions.length === 0 ? (
        <Empty description={t('qualification.payment.noHistory')} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-elevate)' }}>
                <th style={th}>#</th>
                <th style={th}>{t('qualification.payment.colDate')}</th>
                <th style={th}>{t('qualification.payment.colAmount')}</th>
                <th style={th}>{t('qualification.payment.colMethod')}</th>
                <th style={th}>{t('qualification.payment.colStatus')}</th>
                <th style={th}>{t('qualification.payment.colFile')}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, i) => {
                const st = STATUS_STYLE[tx.status];
                return (
                  <tr key={tx.id}>
                    <td style={{ ...td, color: 'var(--color-text-soft)' }}>{i + 1}</td>
                    <td style={td}>{fmtDateTime(tx.createdAt)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{fmt(tx.amount)}</td>
                    <td style={td}>{t(`qualification.payment.${METHOD_KEY[tx.method]}`)}</td>
                    <td style={td}>
                      <span style={{ padding: '2px 10px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500, background: st.bg, color: st.fg }}>
                        {t(`qualification.payment.${st.key}`)}
                      </span>
                    </td>
                    <td style={td}>
                      {tx.file ? (
                        <a href={tx.file} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-info)' }}>
                          {t('qualification.payment.view')}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--color-text-mute)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
