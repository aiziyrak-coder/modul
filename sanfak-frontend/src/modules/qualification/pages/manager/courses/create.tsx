import { useNavigate } from 'react-router-dom';
import { App, Flex, Spin } from 'antd';
import { PageContainer } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import { useTranslation } from '@/shared/lib/i18n';
import { useCourseTypeOptions, useCreateCourse, useTeacherOptions } from '../../../api/course-api';
import type { CourseInput } from '../../../model/course.types';
import CourseForm from '../../../components/course-form';

const BACK = '/qualification/manager/courses';

export default function CourseCreatePage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();

  const courseTypes = useCourseTypeOptions();
  const teachers = useTeacherOptions();
  const create = useCreateCourse();

  const handleSubmit = async (input: CourseInput) => {
    try {
      await create.mutateAsync(input);
      message.success(t('qualification.courses.created'));
      navigate(BACK);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const loadingOptions = courseTypes.isLoading || teachers.isLoading;

  return (
    <PageContainer title={t('qualification.courses.createTitle')}>
      {loadingOptions ? (
        <Flex justify="center" align="center" style={{ flex: 1, minHeight: 320 }}>
          <Spin size="large" />
        </Flex>
      ) : (
        <Flex justify="center" style={{ paddingBottom: 'var(--space-6)' }}>
          <div style={{ width: '100%', maxWidth: 680 }}>
            <CourseForm
              courseTypeOptions={courseTypes.data ?? []}
              teacherOptions={teachers.data ?? []}
              submitting={create.isPending}
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
