import { useEffect, useRef, useState } from 'react';
import type { ReactNode, UIEvent } from 'react';
import { Button, Checkbox, Modal } from 'antd';
import {
  BankOutlined,
  FileProtectOutlined,
  LockOutlined,
  ReadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Flex } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';

export interface OfferData {
  listenerName: string;
  passport?: string | null;
  courseTitle: string;
  courseType?: string;
  form: number;
  creditHours: number;
  startDate?: string;
  endDate?: string;
  price: number;
  contractDate?: string;
}

interface Props {
  data: OfferData;
  accepted: boolean;
  onAcceptedChange: (v: boolean) => void;
}

const INSTITUTE = {
  full: "Farg'ona jamoat salomatligi tibbiyot instituti",
  address: "Farg'ona sh, Yangi turon 2a-uy",
  phone: '73 243 06 62',
  shxr: '400110860304017094100054001',
  stir: '202600504',
  oknx: '92110',
  treasury: "O'zbekiston Respublikasi Moliya Vazirligi G'aznachiligi",
  xr: '23402000300100001010',
  bank: 'XKKM Markaziy bank Toshkent shahar BB',
  mfo: '00014',
  inn: '201122919',
  rektor: 'A. A. Sidikov',
};

const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '—';
const fmtSum = (n: number) => `${(n || 0).toLocaleString('ru-RU')} so'm`;

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h4
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        margin: '22px 0 10px',
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--color-text)',
      }}
    >
      <span style={{ width: 3, height: 15, borderRadius: 2, background: 'var(--brand-primary)', flexShrink: 0 }} />
      {children}
    </h4>
  );
}

function ReqRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0' }}>
      <span style={{ color: 'var(--color-text-mute)', fontSize: 12, flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          color: 'var(--color-text)',
          fontSize: 12.5,
          textAlign: 'right',
          wordBreak: 'break-word',
          ...(mono ? { fontFamily: MONO, letterSpacing: 0.2 } : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PartyCard({ icon, title, subtitle, children }: { icon: ReactNode; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 250,
        border: '1px solid var(--color-border-soft)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--color-bg-elevate)',
      }}
    >
      <Flex
        align="center"
        gap={8}
        style={{ padding: '10px 14px', borderBottom: '1px solid var(--color-border-soft)', background: 'var(--brand-primary-soft)' }}
      >
        <span style={{ color: 'var(--brand-primary)', display: 'inline-flex' }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 11.5, color: 'var(--color-text-mute)' }}>{subtitle}</div> : null}
        </div>
      </Flex>
      <div style={{ padding: '10px 14px' }}>{children}</div>
    </div>
  );
}

export default function OfferAgreement({ data, accepted, onAcceptedChange }: Props) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [readEnd, setReadEnd] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const el = scrollRef.current;
      if (el && el.scrollHeight <= el.clientHeight + 24) {
        setReadEnd(true);
        setProgress(100);
      }
    }, 60);
    return () => window.clearTimeout(id);
  }, [open]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.min(100, Math.round((el.scrollTop / max) * 100)) : 100;
    setProgress(pct);
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setReadEnd(true);
  };

  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: t('qualification.offer.fCourse'), value: data.courseTitle },
    ...(data.courseType ? [{ label: t('qualification.offer.fType'), value: data.courseType }] : []),
    { label: t('qualification.offer.fForm'), value: data.form === 1 ? t('qualification.offer.online') : t('qualification.offer.offline') },
    { label: t('qualification.offer.fHours'), value: t('qualification.offer.hours', { h: data.creditHours }) },
    { label: t('qualification.offer.fPeriod'), value: `${fmtDate(data.startDate)} — ${fmtDate(data.endDate)}` },
    { label: t('qualification.offer.fPrice'), value: fmtSum(data.price), strong: true },
  ];

  const sections: [string, string][] = [
    [t('qualification.offer.s1title'), t('qualification.offer.s1body')],
    [t('qualification.offer.s3title'), t('qualification.offer.s3body')],
    [t('qualification.offer.s4title'), t('qualification.offer.s4body')],
    [t('qualification.offer.s5title'), t('qualification.offer.s5body')],
  ];

  return (
    <>
      <Flex align="center" gap={8} wrap>
        <Checkbox
          checked={accepted}
          onClick={(e) => {
            if (!accepted) {
              e.preventDefault();
              setOpen(true);
            }
          }}
          onChange={(e) => {
            if (!e.target.checked) onAcceptedChange(false);
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--color-text)' }}>{t('qualification.offer.agree')}</span>
        </Checkbox>
        {accepted ? (
          <Button type="link" size="small" icon={<ReadOutlined />} onClick={() => setOpen(true)} style={{ padding: 0 }}>
            {t('qualification.offer.reRead')}
          </Button>
        ) : null}
      </Flex>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        width={780}
        centered
        destroyOnHidden={false}
        title={
          <Flex align="center" gap={10}>
            <span style={{ color: 'var(--brand-primary)', display: 'inline-flex', fontSize: 18 }}>
              <FileProtectOutlined />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{t('qualification.offer.title')}</div>
              <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-mute)' }}>
                {t('qualification.offer.subtitle')}
              </div>
            </div>
          </Flex>
        }
        styles={{ body: { padding: 0 } }}
        footer={
          <Flex align="center" justify={readEnd ? 'flex-end' : 'space-between'} gap={12} wrap style={{ padding: '4px 0' }}>
            {!readEnd ? (
              <Flex align="center" gap={6} style={{ fontSize: 12, color: 'var(--color-text-mute)' }}>
                <LockOutlined />
                {t('qualification.offer.readHint')}
              </Flex>
            ) : null}
            <Button
              type="primary"
              disabled={!readEnd}
              onClick={() => {
                onAcceptedChange(true);
                setOpen(false);
              }}
            >
              {t('qualification.offer.continue')}
            </Button>
          </Flex>
        }
      >
        <div style={{ height: 3, background: 'var(--color-border-soft)' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--brand-primary)', transition: 'width 0.15s ease' }} />
        </div>

        <div
          ref={scrollRef}
          onScroll={onScroll}
          style={{ maxHeight: '60vh', overflowY: 'auto', padding: '18px 22px', fontSize: 13.5, lineHeight: 1.7, color: 'var(--color-text-soft)' }}
        >
        <p style={{ marginTop: 0 }}>
          {t('qualification.offer.intro', { name: data.listenerName, passport: data.passport || '—' })}
        </p>

        <SectionTitle>{t('qualification.offer.s2title')}</SectionTitle>
        <div style={{ border: '1px solid var(--color-border-soft)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {rows.map((r, i) => (
            <div
              key={r.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 16,
                padding: '9px 13px',
                background: r.strong ? 'var(--brand-primary-soft)' : i % 2 ? 'var(--color-bg-elevate)' : 'transparent',
              }}
            >
              <span style={{ color: 'var(--color-text-mute)' }}>{r.label}</span>
              <span
                style={{
                  fontWeight: r.strong ? 800 : 600,
                  fontSize: r.strong ? 14.5 : undefined,
                  color: r.strong ? 'var(--brand-primary)' : 'var(--color-text)',
                  textAlign: 'right',
                }}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>

        {sections.map(([title, body]) => (
          <div key={title}>
            <SectionTitle>{title}</SectionTitle>
            <p style={{ margin: 0 }}>{body}</p>
          </div>
        ))}

        <SectionTitle>{t('qualification.offer.reqTitle')}</SectionTitle>
        <Flex gap={12} wrap align="stretch">
          <PartyCard icon={<BankOutlined />} title={t('qualification.offer.reqExecutor')} subtitle={INSTITUTE.full}>
            <ReqRow label={t('qualification.offer.rAddress')} value={INSTITUTE.address} />
            <ReqRow label={t('qualification.offer.rPhone')} value={INSTITUTE.phone} />
            <ReqRow label={t('qualification.offer.rShAccount')} value={INSTITUTE.shxr} mono />
            <ReqRow label="STIR" value={INSTITUTE.stir} mono />
            <ReqRow label="OKNX" value={INSTITUTE.oknx} mono />
            <ReqRow label={t('qualification.offer.rTreasury')} value={INSTITUTE.treasury} />
            <ReqRow label={t('qualification.offer.rAccount')} value={INSTITUTE.xr} mono />
            <ReqRow label={t('qualification.offer.rBank')} value={INSTITUTE.bank} />
            <ReqRow label="MFO" value={INSTITUTE.mfo} mono />
            <ReqRow label="INN" value={INSTITUTE.inn} mono />
            <ReqRow label={t('qualification.offer.rRektor')} value={INSTITUTE.rektor} />
          </PartyCard>
          <PartyCard icon={<UserOutlined />} title={t('qualification.offer.reqCustomer')} subtitle={data.listenerName}>
            <ReqRow label={t('qualification.offer.rFio')} value={data.listenerName} />
            <ReqRow label={t('qualification.offer.rPassport')} value={data.passport || '—'} mono />
          </PartyCard>
        </Flex>

        <p style={{ margin: '20px 0 0', fontSize: 12, color: 'var(--color-text-mute)' }}>
          {t('qualification.offer.date', { date: fmtDate(data.contractDate) })}
        </p>
        </div>
      </Modal>
    </>
  );
}
