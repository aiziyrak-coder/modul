import { useState } from 'react';
import { Alert, App, Button, Empty, Skeleton, Space, Table, Tabs, Typography } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useModalStore } from '@/shared/ui';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { useTranslation } from '@/shared/lib/i18n';
import { Can, usePermission } from '@/app/session';
import {
  usePersonalPlan,
  useDeleteActivity,
  useCompleteActivity,
  useUpdatePersonalPlanName,
  downloadPersonalPlanPdf,
  getApiErrorMessage,
} from '../api/work-plan-api';
import { useMyTeacherProfile } from '../../profile/api/teacher-profile-api';
import type { ActivitySection, TeachingScience, WorkItem } from '../model/types';
import { cellOf, otherHoursOf } from '../lib/teaching-hours';
import ActivityTable from '../components/activity-table';
import PlanNameEditor from '../components/plan-name-editor';
import WorkItemForm from '../components/work-item-form';
import CompleteActivityModal from '../components/complete-activity-modal';
import ApprovalPanel from '../components/approval-panel';
import ReportsTab from '../components/reports-tab';
import DeleteConfirm from '../../components/delete-confirm';
import StatusBadge from '../../components/status-badge';

const { Text } = Typography;

type SectionTabKey = 'sciences' | ActivitySection;

const WRITABLE_SECTIONS: ActivitySection[] = [
  'methodicalWork',
  'researchWork',
  'mentoringWork',
  'organizationalWork',
  'extraWork',
];

const SECTION_TAB_I18N_KEY: Record<ActivitySection, string> = {
  methodicalWork: 'teacher.personalPlan.tab.methodical',
  researchWork: 'teacher.personalPlan.tab.research',
  mentoringWork: 'teacher.personalPlan.tab.mentoring',
  organizationalWork: 'teacher.personalPlan.tab.organizational',
  extraWork: 'teacher.personalPlan.tab.extra',
};

const VENUE_SECTIONS: ActivitySection[] = ['organizationalWork', 'mentoringWork'];

function buildScienceColumns(t: (key: string) => string) {
  return [
    {
      title: t('teacher.personalPlan.table.science'),
      dataIndex: 'scienceName' as keyof TeachingScience,
      key: 'scienceName',
      render: (v: string | null) => <strong>{v ?? '—'}</strong>,
    },
    {
      title: t('teacher.personalPlan.table.course'),
      dataIndex: 'course' as keyof TeachingScience,
      key: 'course',
      width: 70,
      render: (v: number) => (v > 0 ? `${v}-kurs` : '—'),
    },
    {
      title: t('teacher.personalPlan.table.semester'),
      dataIndex: 'semester' as keyof TeachingScience,
      key: 'semester',
      width: 80,
      render: (v: number) => (v > 0 ? `${v}` : '—'),
    },
    {
      title: t('teacher.personalPlan.table.streamCount'),
      key: 'streamCount',
      width: 80,
      render: (_: unknown, r: TeachingScience) => cellOf(r.streamCount),
    },
    {
      title: t('teacher.personalPlan.table.groupCount'),
      key: 'groupCount',
      width: 80,
      render: (_: unknown, r: TeachingScience) => cellOf(r.groupCount),
    },
    {
      title: t('teacher.personalPlan.table.lecture'),
      key: 'lecture',
      width: 80,
      render: (_: unknown, r: TeachingScience) => r.hoursByType.lecture || '—',
    },
    {
      title: t('teacher.personalPlan.table.practical'),
      key: 'seminar',
      width: 80,
      render: (_: unknown, r: TeachingScience) => r.hoursByType.seminar || '—',
    },
    {
      title: t('teacher.personalPlan.table.laboratory'),
      key: 'laboratory',
      width: 100,
      render: (_: unknown, r: TeachingScience) => r.hoursByType.laboratory || '—',
    },
    {
      title: t('teacher.personalPlan.table.clinical'),
      key: 'practical',
      width: 80,
      render: (_: unknown, r: TeachingScience) => r.hoursByType.practical || '—',
    },
    {
      title: t('teacher.personalPlan.table.on'),
      key: 'on',
      width: 60,
      render: (_: unknown, r: TeachingScience) => cellOf(r.hoursByType.on),
    },
    {
      title: t('teacher.personalPlan.table.yan'),
      key: 'yan',
      width: 60,
      render: (_: unknown, r: TeachingScience) => cellOf(r.hoursByType.yan),
    },
    {
      title: t('teacher.personalPlan.table.retake'),
      key: 'retake',
      width: 90,
      render: (_: unknown, r: TeachingScience) => cellOf(r.hoursByType.retake),
    },
    {
      title: t('teacher.personalPlan.table.practiceLead'),
      key: 'practiceLead',
      width: 100,
      render: (_: unknown, r: TeachingScience) => cellOf(r.hoursByType.practiceLead),
    },
    {
      title: t('teacher.personalPlan.table.independent'),
      key: 'independent',
      width: 90,
      render: (_: unknown, r: TeachingScience) => otherHoursOf(r) || '—',
    },
    {
      title: t('teacher.personalPlan.table.totalHour'),
      dataIndex: 'totalHour' as keyof TeachingScience,
      key: 'totalHour',
      width: 90,
      render: (v: number) => <strong>{v}</strong>,
    },
    {
      title: t('teacher.personalPlan.table.stavka'),
      dataIndex: 'stavka' as keyof TeachingScience,
      key: 'stavka',
      width: 80,
      render: (v: number) => v,
    },
  ];
}

const PersonalPlanDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { message } = App.useApp();
  const showModal = useModalStore((s) => s.showModal);
  const scienceColumns = buildScienceColumns(t);

  const [activeSection, setActiveSection] = useState<SectionTabKey>('sciences');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data, isLoading, isError } = usePersonalPlan(id);
  const planTitle = data
    ? data.name
      ? `${data.name}${data.academicYearTitle ? ` (${data.academicYearTitle})` : ''}`
      : t('teacher.personalPlan.name.defaultTemplate', { year: data.academicYearTitle ?? '' })
    : '';
  usePageTitle(planTitle, { back: true });
  const { data: myProfile, isSuccess: profileLoaded } = useMyTeacherProfile();
  const can = usePermission();
  const ownsPlans = can('personalWorkPlan:update');
  const isBlocked =
    ownsPlans && profileLoaded && (myProfile === null || myProfile.hrApprovalStatus !== 'approved');
  const blockedStatusLabel = !myProfile
    ? t('teacher.profile.status.newProfileTitle')
    : t(`teacher.profile.status.${myProfile.hrApprovalStatus}`);

  const deleteActivity = useDeleteActivity(id ?? '');
  const completeActivity = useCompleteActivity(id ?? '');
  const updateName = useUpdatePersonalPlanName(id ?? '');

  const handleAddWorkItem = (section: ActivitySection) => {
    if (!id) return;
    showModal({
      title: t('teacher.personalPlan.form.addTitleTemplate', { section: t(SECTION_TAB_I18N_KEY[section]) }),
      body: () => <WorkItemForm planId={id} section={section} />,
      maxWidth: '545px',
      bodyPadding: '0',
      overflow: true,
    });
  };

  const handleEditWorkItem = (section: ActivitySection, item: WorkItem) => {
    if (!id) return;
    showModal({
      title: t('teacher.personalPlan.form.editTitleTemplate', { section: t(SECTION_TAB_I18N_KEY[section]) }),
      body: () => <WorkItemForm planId={id} section={section} item={item} />,
      maxWidth: '545px',
      bodyPadding: '0',
      overflow: true,
    });
  };

  const handleDeleteWorkItem = (section: ActivitySection, item: WorkItem) => {
    showModal({
      withHeader: false,
      maxWidth: '460px',
      body: () => (
        <DeleteConfirm
          title={t('teacher.personalPlan.deleteActivityTitle')}
          subtitle={t('teacher.personalPlan.deleteActivitySubtitle', { title: item.title })}
          loading={deleteActivity.isPending}
          onConfirm={() => {
            void deleteActivity
              .mutateAsync({ activityId: item.id, section })
              .then(() => {
                message.success(t('teacher.personalPlan.activityDeleted'));
                useModalStore.getState().hideModal();
              })
              .catch((e: unknown) => message.error(getApiErrorMessage(e)));
          }}
        />
      ),
    });
  };

  const handleCompleteWorkItem = (
    section: ActivitySection,
    item: { id: string; plannedCount?: number | null },
  ) => {
    showModal({
      withHeader: false,
      maxWidth: '420px',
      body: () => (
        <CompleteActivityModal
          section={section}
          plannedCount={item.plannedCount ?? 0}
          loading={completeActivity.isPending}
          onConfirm={(fileUrl, link, actualCount) => {
            void completeActivity
              .mutateAsync({ activityId: item.id, section, fileUrl, link, actualCount })
              .then(() => {
                message.success(t('teacher.personalPlan.complete.success'));
                useModalStore.getState().hideModal();
              })
              .catch((e: unknown) => message.error(getApiErrorMessage(e)));
          }}
        />
      ),
    });
  };

  const handleSaveName = (name: string) => {
    updateName
      .mutateAsync(name)
      .then(() => message.success(t('teacher.personalPlan.name.editSuccess')))
      .catch((e: unknown) => message.error(getApiErrorMessage(e)));
  };

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={{ padding: 'var(--space-6)' }}>
        <Empty description={t('teacher.personalPlan.notFound')} />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            {t('teacher.common.back')}
          </Button>
        </div>
      </div>
    );
  }

  const displayName =
    data.name ?? t('teacher.personalPlan.name.defaultTemplate', { year: data.academicYearTitle ?? '' });
  const canComplete = data.status === 'approved';
  const nameEditable = data.status === 'draft';

  const handleDownloadPdf = () => {
    if (!id) return;
    setDownloadingPdf(true);
    const filename = data.academicYearTitle
      ? `shaxsiy-ish-reja-${data.academicYearTitle}.pdf`
      : 'shaxsiy-ish-reja.pdf';
    downloadPersonalPlanPdf(id, filename)
      .catch((e: unknown) => message.error(getApiErrorMessage(e)))
      .finally(() => setDownloadingPdf(false));
  };

  const activityBySection: Record<ActivitySection, WorkItem[]> = {
    methodicalWork: data.methodicalWork,
    researchWork: data.researchWork,
    mentoringWork: data.mentoringWork,
    organizationalWork: data.organizationalWork,
    extraWork: data.extraWork,
  };

  const renderSectionContent = () => {
    if (activeSection === 'sciences') {
      return (
        <div>
          <Text
            strong
            style={{ fontSize: 14, display: 'block', marginBottom: 12, color: 'var(--color-text)' }}
          >
            {t('teacher.personalPlan.section.sciences', { count: data.sciences.length })}
          </Text>
          {data.sciences.length === 0 ? (
            <Empty
              description={t('teacher.personalPlan.noSciencesHint')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <>
              <Table<TeachingScience>
                dataSource={data.sciences}
                columns={scienceColumns}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 1280 }}
                style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}
              />
              {data.sciences.some((s) => !s.decomposed) ? (
                <Text type="secondary" style={{ display: 'block', marginTop: 'var(--space-2)' }}>
                  {t('teacher.personalPlan.table.legacyNote')}
                </Text>
              ) : null}
            </>
          )}
        </div>
      );
    }

    const section = activeSection;
    return (
      <ActivityTable
        items={activityBySection[section]}
        showVenueColumn={VENUE_SECTIONS.includes(section)}
        showLinkColumn={section === 'researchWork'}
        disabled={isBlocked}
        canComplete={canComplete}
        onEdit={(item) => handleEditWorkItem(section, item)}
        onDelete={(item) => handleDeleteWorkItem(section, item)}
        onComplete={(item) => handleCompleteWorkItem(section, item)}
      />
    );
  };

  const innerTabItems = [
    { key: 'sciences', label: t('teacher.personalPlan.tab.sciences') },
    ...WRITABLE_SECTIONS.map((section) => ({ key: section, label: t(SECTION_TAB_I18N_KEY[section]) })),
  ];

  const workPlansTabContent = (
    <>
      <PlanNameEditor name={displayName} editable={nameEditable} saving={updateName.isPending} onSave={handleSaveName} />

      <Tabs
        activeKey={activeSection}
        onChange={(key) => setActiveSection(key as SectionTabKey)}
        items={innerTabItems}
        tabBarExtraContent={
          <Space>
            <Button icon={<DownloadOutlined />} loading={downloadingPdf} onClick={handleDownloadPdf}>
              {t('teacher.personalPlan.pdf.button')}
            </Button>
            {activeSection !== 'sciences' ? (
              <Can perform="personalWorkPlan:update">
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  disabled={isBlocked}
                  onClick={() => handleAddWorkItem(activeSection)}
                >
                  {t('teacher.personalPlan.addButton')}
                </Button>
              </Can>
            ) : null}
          </Space>
        }
      />

      <div style={{ marginTop: 'var(--space-2)' }}>{renderSectionContent()}</div>

      <div style={{ marginTop: 'var(--space-6)' }}>
        <ApprovalPanel plan={data} disabled={isBlocked} />
      </div>
    </>
  );

  return (
    <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
      <Space size={12} align="start" style={{ marginBottom: 'var(--space-4)' }}>
        <StatusBadge status={data.status} />
      </Space>

      {isBlocked ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 'var(--space-4)' }}
          message={t('teacher.personalPlan.blockedTitle')}
          description={t('teacher.personalPlan.blockedDesc', { status: blockedStatusLabel })}
          action={
            <Button size="small" onClick={() => navigate('/teacher/profile')}>
              {t('teacher.personalPlan.blockedGoToProfile')}
            </Button>
          }
        />
      ) : null}

      <Tabs
        items={[
          { key: 'workPlans', label: t('teacher.personalPlan.tab.workPlans'), children: workPlansTabContent },
          {
            key: 'reports',
            label: t('teacher.personalPlan.tab.reports'),
            children: <ReportsTab planId={data.id} academicYearId={data.academicYearId} />,
          },
        ]}
      />
    </div>
  );
};

export default PersonalPlanDetailPage;
