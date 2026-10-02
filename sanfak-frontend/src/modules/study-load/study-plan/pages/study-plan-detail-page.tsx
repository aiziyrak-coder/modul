import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  App,
  Button,
  Empty,
  Skeleton,
} from 'antd';
import { EditOutlined, SaveOutlined } from '@ant-design/icons';
import { Can } from '@/app/session';
import {
  useStudyPlanDetail,
  useStudyPlanPlan,
  useUpdateStudyPlanDetail,
} from '../api/detail-api';
import StudyPlanPlanTab from '../components/study-plan-plan-tab';
import {
  useAcademicLevels,
  useEducationForms,
  useReadingForms,
  useSpecializations,
  useStudyPeriods,
} from '../api/references';
import { useDirections } from '../api/study-plan-api';
import StudyPlanInfo from '../components/study-plan-info';
import type { InfoFormValues } from '../components/study-plan-info/schema';
import StudyPlanProcessTab from '../components/study-plan-process-tab';
import StudyPlanCompositionTab from '../components/study-plan-composition-tab';
import SegmentedTabs from '../../components/segmented-tabs';
import { usePageTitle } from '@/shared/lib/page-title-store';
import { useTranslation } from '@/shared/lib/i18n';

const StudyPlanDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { message } = App.useApp();

  const TAB_OPTIONS = [
    { key: 'info', label: t('studyLoad.studyPlan.tab.info') },
    { key: 'process', label: t('studyLoad.workingSchedule.tab.process') },
    { key: 'plan', label: t('studyLoad.workingSchedule.tab.plan') },
    { key: 'composition', label: t('studyLoad.studyPlan.tab.composition') },
  ];

  const [activeTab, setActiveTab] = useState('info');
  const [editMode, setEditMode] = useState(false);

  const infoFormRef = useRef<{ submitForm: () => void } | null>(null);

  const detailQuery = useStudyPlanDetail(id);
  const updateMutation = useUpdateStudyPlanDetail();
  const planQuery = useStudyPlanPlan(id);

  const detail = detailQuery.data;

  usePageTitle(t('studyLoad.studyPlan.editPageTitle'), { back: true });

  const { data: directions = [] } = useDirections();
  const { data: academicLevels = [] } = useAcademicLevels();
  const { data: educationForms = [] } = useEducationForms();
  const { data: readingForms = [] } = useReadingForms();
  const { data: specializations = [] } = useSpecializations();
  const { data: studyPeriods = [] } = useStudyPeriods();

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setEditMode(false);
  };

  const handleInfoSubmit = async (values: InfoFormValues) => {
    if (!id) return;
    const fd = new FormData();
    fd.append('direction', values.direction);
    fd.append('academicLevel', values.academicLevel);
    fd.append('educationForm', values.educationForm);
    fd.append('readingForm', values.readingForm);
    fd.append('specialization', values.specialization);
    fd.append('studyPeriod', values.studyPeriod);
    fd.append('year', values.year);
    if (values.comment) fd.append('comment', values.comment);
    if (values.studyProcessFile) fd.append('file', values.studyProcessFile);
    if (values.studyPlanFile) fd.append('planFile', values.studyPlanFile);

    try {
      await updateMutation.mutateAsync({ id, formData: fd });
      message.success(t('studyLoad.studyPlan.infoUpdated'));
      setEditMode(false);
    } catch {
      message.error(t('studyLoad.common.errorOccurred'));
    }
  };

  const handleSaveOrEdit = () => {
    if (editMode) {
      infoFormRef.current?.submitForm();
    } else {
      setEditMode(true);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'info':
        return detailQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 10 }} />
        ) : detailQuery.isError || !detail ? (
          <Empty
            description={t('studyLoad.common.dataLoadError')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <StudyPlanInfo
            editMode={editMode}
            data={detail}
            directions={directions}
            academicLevels={academicLevels}
            educationForms={educationForms}
            readingForms={readingForms}
            specializations={specializations}
            studyPeriods={studyPeriods}
            onSubmit={handleInfoSubmit}
            formRef={infoFormRef}
          />
        );

      case 'process':
        return detailQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : !detail ? (
          <Empty
            description={t('studyLoad.common.dataLoadError')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <StudyPlanProcessTab
            learningProcessId={detail.id}
            keys={detail.keys}
            courses={detail.courses}
            allValues={detail.allValues}
          />
        );

      case 'plan':
        return (
          <StudyPlanPlanTab
            isLoading={planQuery.isLoading}
            isError={planQuery.isError}
            data={planQuery.data}
          />
        );

      case 'composition':
        return detailQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : !detail ? (
          <Empty
            description={t('studyLoad.common.dataLoadError')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : detail.learningProcess?.keys?.length ? (
          <StudyPlanCompositionTab
            id={detail.id}
            keys={detail.learningProcess.keys}
            title={detail.learningProcess.title}
          />
        ) : (
          <Empty
            description={t('studyLoad.studyPlan.compositionNotFound')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ padding: 'var(--space-4) var(--space-6)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 'var(--space-3)',
        }}
      >
        <SegmentedTabs
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={handleTabChange}
        />
        {activeTab === 'info' ? (
          <Can perform="learningProcess:update">
            <Button
              type={editMode ? 'primary' : 'default'}
              icon={editMode ? <SaveOutlined /> : <EditOutlined />}
              onClick={handleSaveOrEdit}
              loading={updateMutation.isPending}
            >
              {editMode ? t('studyLoad.common.save') : t('studyLoad.common.change')}
            </Button>
          </Can>
        ) : null}
      </div>

      {renderContent()}
    </div>
  );
};

export default StudyPlanDetailPage;
