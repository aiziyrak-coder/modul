import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Col, Empty, Flex, Pagination, Row, Select, Spin } from 'antd';
import { PageContainer } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import { useCoursesPaginated } from '../../../api/course-api';
import { COURSE_STATUS, EDU_FORM } from '../../../model/course.types';
import TeacherCourseCard from '../../../components/teacher-course-card';

const LIMIT = 12;

export default function TeacherCoursesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [form, setForm] = useState<string | undefined>(undefined);

  const { data, isLoading, isFetching } = useCoursesPaginated({
    page,
    limit: LIMIT,
    status: status ? Number(status) : undefined,
    form: form ? Number(form) : undefined,
  });
  const rows = data?.items ?? [];
  const total = data?.meta.total ?? 0;

  const statusOptions = [
    { value: String(COURSE_STATUS.PLANNED), label: t('qualification.courses.status.planned') },
    { value: String(COURSE_STATUS.ACTIVE), label: t('qualification.courses.status.active') },
    { value: String(COURSE_STATUS.FINISHED), label: t('qualification.courses.status.finished') },
  ];
  const formOptions = [
    { value: String(EDU_FORM.ONLINE), label: t('qualification.courses.form.online') },
    { value: String(EDU_FORM.OFFLINE), label: t('qualification.courses.form.offline') },
  ];

  return (
    <PageContainer title={t('qualification.teacherCourses.nav')}>
      <Flex gap={12} wrap="wrap" style={{ marginBottom: 'var(--space-4)' }}>
        <Select
          allowClear
          placeholder={t('qualification.courses.col.status')}
          value={status}
          options={statusOptions}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          style={{ width: 200, height: 38 }}
        />
        <Select
          allowClear
          placeholder={t('qualification.courses.col.form')}
          value={form}
          options={formOptions}
          onChange={(v) => {
            setForm(v);
            setPage(1);
          }}
          style={{ width: 180, height: 38 }}
        />
      </Flex>

      <Spin spinning={!!isFetching || isLoading}>
        {rows.length === 0 && (isLoading || isFetching) ? (
          <div style={{ minHeight: 240 }} />
        ) : rows.length === 0 ? (
          <Flex align="center" justify="center" style={{ flex: 1, minHeight: 240 }}>
            <Empty description={t('qualification.teacherCourses.empty')} />
          </Flex>
        ) : (
          <Row gutter={[24, 24]}>
            {rows.map((c) => (
              <Col key={c.id} xs={24} md={12} xl={8}>
                <TeacherCourseCard
                  course={c}
                  onEnter={() => navigate(`/qualification/teacher/courses/${c.id}/entrance-test`)}
                />
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      {total > LIMIT && (
        <Flex justify="flex-end" style={{ marginTop: 'var(--space-4)' }}>
          <Pagination
            current={page}
            pageSize={LIMIT}
            total={total}
            onChange={setPage}
            showSizeChanger={false}
          />
        </Flex>
      )}
      <div aria-hidden style={{ height: 'var(--space-8, 40px)', flexShrink: 0 }} />
    </PageContainer>
  );
}
