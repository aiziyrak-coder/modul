import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  BellOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { Button, Input, Modal, Tag, Tooltip, Typography } from 'antd';
import { PageContainer, Card, DataTable, Flex } from '@/shared/ui';
import { TableGap } from '../../../components/table-gap';
import { useTranslation } from '@/shared/lib/i18n';
import { useCoursesPaginated } from '../../../api/course-api';
import { useNotifications } from '../../../api/notification-api';
import { useCalendarPlans } from '../../../api/calendar-plan-api';
import { useMyPetitions } from '../../../api/petition-api';
import { EDU_FORM } from '../../../model/course.types';
import type { Course, EduForm } from '../../../model/course.types';
import EnrollmentForm from '../../../components/enrollment-form';
import QualStepper from '../../../components/qual-stepper';
import CourseStatusTag from '../../../components/course-status-tag';

const { Text, Title } = Typography;
const LIMIT = 12;
const fmtDate = (s?: string) =>
  s ? new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export default function StudentEnrollmentPage() {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [successOpen, setSuccessOpen] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);

  return (
    <PageContainer title={step === 2 ? t('qualification.enroll.modalTitle') : t('qualification.enroll.title')}>
      <Card size="small" style={{ marginBottom: 'var(--space-4)', flexShrink: 0 }}>
        <QualStepper
          current={step}
          steps={[
            { label: t('qualification.enroll.step1') },
            { label: t('qualification.enroll.step2') },
          ]}
        />
      </Card>

      {step === 1 ? (
        <Step1CourseSelection
          onSelect={(c) => {
            setCourse(c);
            setStep(2);
          }}
        />
      ) : course ? (
        <>
          <EnrollmentForm
            course={course}
            onBack={() => setStep(1)}
            onSuccess={() => {
              setSuccessOpen(true);
              setCourse(null);
              setStep(1);
            }}
          />
          <div style={{ height: 24, flexShrink: 0 }} />
        </>
      ) : null}

      <Modal
        open={successOpen}
        onCancel={() => setSuccessOpen(false)}
        footer={null}
        centered
        width={460}
        styles={{ body: { padding: '8px 8px 4px' } }}
      >
        <SuccessContent />
      </Modal>
    </PageContainer>
  );
}

function Step1CourseSelection({ onSelect }: { onSelect: (c: Course) => void }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);
  const [search, setSearch] = useState('');

  const { data, isFetching } = useCoursesPaginated({ page, limit: pageSize, search: search || undefined });
  const { data: notifications = [] } = useNotifications();
  const { data: plans = [] } = useCalendarPlans();
  const { data: applied } = useMyPetitions();
  const rows = data?.items ?? [];

  const formTag = (f: EduForm) =>
    f === EDU_FORM.ONLINE ? (
      <Tag color="blue">{t('qualification.courses.form.online')}</Tag>
    ) : (
      <Tag color="gold">{t('qualification.courses.form.offline')}</Tag>
    );

  const columns: ColumnDef<Course, unknown>[] = [
    {
      header: '#',
      id: 'idx',
      size: 56,
      cell: ({ row }) => (
        <span style={{ color: 'var(--color-text-soft)', fontSize: 13 }}>
          {(page - 1) * pageSize + row.index + 1}
        </span>
      ),
    },
    {
      header: t('qualification.enroll.colName'),
      accessorKey: 'title',
      cell: ({ row }) => <strong>{row.original.title}</strong>,
    },
    { header: t('qualification.enroll.colForm'), id: 'form', size: 110, cell: ({ row }) => formTag(row.original.form) },
    {
      header: t('qualification.enroll.colPrice'),
      id: 'price',
      size: 120,
      cell: ({ row }) => `${row.original.price.toLocaleString('ru-RU')} so'm`,
    },
    {
      header: t('qualification.enroll.colCredit'),
      id: 'credit',
      size: 90,
      cell: ({ row }) => t('qualification.enroll.creditVal', { h: row.original.creditHours }),
    },
    { header: t('qualification.enroll.colStart'), id: 'start', size: 110, cell: ({ row }) => fmtDate(row.original.startDate) },
    { header: t('qualification.enroll.colEnd'), id: 'end', size: 110, cell: ({ row }) => fmtDate(row.original.endDate) },
    {
      header: t('qualification.enroll.colSpots'),
      id: 'spots',
      size: 100,
      cell: ({ row }) => {
        const left = row.original.listenersLimit - row.original.totalSubscribers;
        return left > 0 ? <Text>{left}</Text> : <Text type="danger">{t('qualification.enroll.spotsFull')}</Text>;
      },
    },
    {
      header: t('qualification.courses.col.status'),
      id: 'status',
      size: 130,
      cell: ({ row }) => <CourseStatusTag status={row.original.status} />,
    },
    {
      header: t('actions'),
      id: 'actions',
      size: 150,
      meta: { align: 'center' as const },
      cell: ({ row }) => {
        const left = row.original.listenersLimit - row.original.totalSubscribers;
        const st = applied?.get(row.original.id);
        if (st === 2) {
          return (
            <Tag color="green" icon={<CheckCircleOutlined />} style={{ margin: 0 }}>
              {t('qualification.enroll.approved')}
            </Tag>
          );
        }
        if (st === 1) {
          return (
            <Tag color="gold" icon={<ClockCircleOutlined />} style={{ margin: 0 }}>
              {t('qualification.enroll.applied')}
            </Tag>
          );
        }
        if (row.original.status === 3) return null;

        return (
          <Tooltip title={left <= 0 ? t('qualification.enroll.spotsFull') : ''}>
            <Button
              type="primary"
              size="small"
              icon={<UserAddOutlined />}
              disabled={left <= 0}
              onClick={() => onSelect(row.original)}
              style={{ height: 32, borderRadius: 'var(--radius-md)', fontWeight: 500 }}
            >
              {t('qualification.enroll.apply')}
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Flex vertical gap={16} style={{ flex: 1, minHeight: 0 }}>
      {notifications.length > 0 ? (
        <Flex vertical gap={8}>
          {notifications.map((n) => (
            <Flex
              key={n.id}
              align="flex-start"
              gap={10}
              style={{
                background: 'var(--color-info-bg, #eff6ff)',
                border: '1px solid var(--color-info-border, #bfdbfe)',
                borderRadius: 'var(--radius-lg, 12px)',
                padding: '10px 14px',
              }}
            >
              <BellOutlined style={{ color: '#2563eb', marginTop: 3 }} />
              <Text style={{ color: '#1e40af', fontSize: 13 }}>{n.text}</Text>
            </Flex>
          ))}
        </Flex>
      ) : null}

      {plans.length > 0 ? (
        <Card size="small">
          <Flex align="center" gap={8} style={{ marginBottom: 10 }}>
            <CalendarOutlined style={{ color: 'var(--brand-primary, #37cb94)' }} />
            <Text strong>{t('qualification.enroll.calendarPlans')}</Text>
          </Flex>
          <Flex vertical gap={8}>
            {plans.map((p) => (
              <Flex
                key={p.id}
                align="center"
                justify="space-between"
                gap={12}
                style={{
                  padding: '9px 12px',
                  border: '1px solid var(--color-border-soft, #eef2f6)',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: 'var(--color-bg-soft, #f8fafc)',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: 500 }}>{p.title}</Text>
                <a
                  href={p.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--brand-primary, #37cb94)', fontWeight: 500 }}
                >
                  <DownloadOutlined />
                  {t('qualification.enroll.download')}
                </a>
              </Flex>
            ))}
          </Flex>
        </Card>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <Flex align="center" style={{ marginBottom: 12, flexShrink: 0 }}>
          <Input.Search
            allowClear
            placeholder={t('qualification.enroll.search')}
            onSearch={(v) => {
              setSearch(v);
              setPage(1);
            }}
            style={{ maxWidth: 360, height: 38 }}
          />
        </Flex>
        <TableGap>
          <DataTable<Course>
            data={rows}
            columns={columns}
            loading={isFetching}
            page={page}
            pageSize={pageSize}
            total={data?.meta.total}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
          />
        </TableGap>
      </div>
    </Flex>
  );
}

function SuccessContent() {
  const { t } = useTranslation();
  return (
    <Flex vertical align="center" gap={10} style={{ padding: '20px 12px 8px', textAlign: 'center' }}>
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--color-info-bg, #dbeafe)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <CheckCircleOutlined style={{ fontSize: 40, color: '#2563eb' }} />
      </div>
      <Title level={4} style={{ margin: 0 }}>
        {t('qualification.enroll.successTitle')}
      </Title>
      <Text type="secondary">{t('qualification.enroll.successMsg')}</Text>
      <Text type="secondary" style={{ maxWidth: 340 }}>
        {t('qualification.enroll.successBody')}
      </Text>
      <Flex
        align="center"
        justify="center"
        gap={8}
        style={{
          width: '100%',
          marginTop: 12,
          padding: '11px 14px',
          background: 'var(--color-warning-bg, #fefce8)',
          border: '1px solid var(--color-warning-border, #fde68a)',
          borderRadius: 'var(--radius-lg, 12px)',
        }}
      >
        <span>⏳</span>
        <Text style={{ color: '#a16207', fontSize: 13, fontWeight: 500 }}>
          {t('qualification.enroll.successPending')}
        </Text>
      </Flex>
    </Flex>
  );
}
