import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/shared/lib/i18n';
import { Button, Tag, Skeleton, Empty } from 'antd';
import { ArrowLeftOutlined, LockOutlined } from '@ant-design/icons';
import type { Semester } from '../model/types';
import { useTeacherProfile } from '../api/education-quality-api';
import { isTeacherActive } from '../lib/teacher-access';
import SubmissionHistory from '../components/submission-history';
import { Page } from '../components/table-pagination/style';

const LIST_PATH = '/education-quality/reports/teacher';

export default function TeacherDetailPage() {
  const { t } = useTranslation();
  const { teacherId } = useParams<{ teacherId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: profile, isLoading } = useTeacherProfile(teacherId);

  const yearParam = searchParams.get('year') ?? undefined;
  const semesterParam = searchParams.get('semester');
  const semester: Semester | undefined =
    semesterParam === '1' ? 1 : semesterParam === '2' ? 2 : undefined;

  const backTarget = useMemo(() => {
    const qs = searchParams.toString();
    return qs ? `${LIST_PATH}?${qs}` : LIST_PATH;
  }, [searchParams]);

  const backBtn = (
    <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(backTarget)}>
      {t('educationQuality.common.back')}
    </Button>
  );

  if (isLoading) {
    return (
      <div>
        {backBtn}
        <Skeleton active paragraph={{ rows: 6 }} style={{ marginTop: 16 }} />
      </div>
    );
  }

  if (!profile || !teacherId) {
    return (
      <div>
        {backBtn}
        <Empty
          description={t('educationQuality.teacherDetail.notFound')}
          style={{ padding: '60px 0' }}
        />
      </div>
    );
  }

  const active = isTeacherActive(profile);

  return (
    <Page>
      <div style={{ marginBottom: 12 }}>{backBtn}</div>

      <SubmissionHistory
        teacherId={teacherId}
        showFilesZip
        initialAcademicYear={yearParam}
        initialSemester={semester}
        header={
          <div>
            <h2 style={{ margin: 0 }}>{profile.fullName}</h2>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginTop: 6,
              color: 'var(--color-text-tertiary, #667085)',
            }}>
              {profile.position && <span>{profile.position}</span>}
              {profile.department && <span>&middot; {profile.department}</span>}
              {profile.faculty && <span>&middot; {profile.faculty}</span>}
              <Tag color={active ? 'success' : 'error'} style={{ marginLeft: 4 }}>
                {active
                  ? t('educationQuality.teacherDetail.active')
                  : t('educationQuality.teacherDetail.inactive')}
              </Tag>
              {!active && profile.activeFrom && (
                <Tag icon={<LockOutlined />} color="warning">
                  {t('educationQuality.teacherDetail.activeFrom', { date: profile.activeFrom })}
                </Tag>
              )}
            </div>
          </div>
        }
      />
    </Page>
  );
}
