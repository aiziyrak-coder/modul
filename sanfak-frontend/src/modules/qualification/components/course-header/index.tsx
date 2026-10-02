import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Flex, Typography } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import { EDU_FORM } from '../../model/course.types';
import type { CourseStatus, EduForm } from '../../model/course.types';

const { Text, Title } = Typography;

const STATUS_KEY: Record<CourseStatus, string> = {
  1: 'qualification.courses.status.planned',
  2: 'qualification.courses.status.active',
  3: 'qualification.courses.status.finished',
};

interface HeaderCourse {
  title: string;
  form: EduForm;
  status: CourseStatus;
}

interface IProps {
  course?: HeaderCourse;
  fallbackTitle: string;
  onBack: () => void;
}

export default function CourseHeader({ course, fallbackTitle, onBack }: IProps) {
  const { t } = useTranslation();

  const formLabel = course
    ? t(
        course.form === EDU_FORM.ONLINE
          ? 'qualification.courses.form.online'
          : 'qualification.courses.form.offline',
      )
    : '';
  const statusLabel = course ? t(STATUS_KEY[course.status]) : '';

  return (
    <Flex align="center" gap={12} style={{ marginBottom: 'var(--space-4)' }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
      <div>
        <Title level={5} style={{ margin: 0, fontSize: 18, lineHeight: 1.3 }}>
          {course?.title ?? fallbackTitle}
        </Title>
        {course ? (
          <Text type="secondary">
            {formLabel} · {statusLabel}
          </Text>
        ) : null}
      </div>
    </Flex>
  );
}
