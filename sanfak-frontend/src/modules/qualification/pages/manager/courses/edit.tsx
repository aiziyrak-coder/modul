import { useNavigate, useParams } from 'react-router-dom';
import { App, Flex, Spin } from 'antd';
import { PageContainer } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import {
  useCourseDetail,
  useCourseTypeOptions,
  useTeacherOptions,
  useUpdateCourse,
} from '../../../api/course-api';
import type { CourseInput } from '../../../model/course.types';
import CourseForm from '../../../components/course-form';

const BACK = '/qualification/manager/courses';

export default function CourseEditPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id: string }>();

  const detail = useCourseDetail(id);
  const courseTypes = useCourseTypeOptions();
  const teachers = useTeacherOptions();
  const update = useUpdateCourse();

  const loading = detail.isLoading || courseTypes.isLoading || teachers.isLoading;

  const handleSubmit = async (input: CourseInput) => {
    try {
      await update.mutateAsync({ id, input });
      message.success(t('qualification.courses.updated'));
      navigate(BACK);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  return (
    <PageContainer title={t('qualification.courses.editTitle')}>
      {loading || !detail.data ? (
        <Flex justify="center" align="center" style={{ flex: 1, minHeight: 320 }}>
          <Spin size="large" />
        </Flex>
      ) : (
        <Flex justify="center" style={{ paddingBottom: 'var(--space-6)' }}>
          <div style={{ width: '100%', maxWidth: 680 }}>
            <CourseForm
              courseTypeOptions={courseTypes.data ?? []}
              teacherOptions={teachers.data ?? []}
              defaultValues={detail.data}
              submitting={update.isPending}
              onSubmit={handleSubmit}
              onCancel={() => navigate(BACK)}
            />
          </div>
        </Flex>
      )}
      <div aria-hidden style={{ height: 'var(--space-8, 40px)', flexShrink: 0 }} />
    </PageContainer>
  );
}
