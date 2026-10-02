import { CalendarOutlined, TeamOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from '@/shared/lib/i18n';
import { EDU_FORM } from '../../model/course.types';
import type { Course } from '../../model/course.types';
import CourseStatusTag from '../course-status-tag';

const { Text, Title } = Typography;
const fmt = (d?: string): string => (d ? dayjs(d).format('DD.MM.YYYY') : '—');

interface IProps {
  course: Course;
  onEnter: () => void;
}

export default function TeacherCourseCard({ course, onEnter }: IProps) {
  const { t } = useTranslation();

  const formTag =
    course.form === EDU_FORM.ONLINE ? (
      <Tag color="blue">{t('qualification.courses.form.online')}</Tag>
    ) : (
      <Tag color="gold">{t('qualification.courses.form.offline')}</Tag>
    );

  return (
    <Card
      style={{ height: '100%' }}
      styles={{ body: { display: 'flex', flexDirection: 'column', gap: 18, height: '100%', padding: 24 } }}
    >
      <Flex align="flex-start" justify="space-between" gap={8}>
        <Title level={5} style={{ margin: 0, flex: 1, fontSize: 18, lineHeight: 1.3 }}>
          {course.title}
        </Title>
        <Flex gap={4} wrap="wrap" style={{ flexShrink: 0 }}>
          {formTag}
          <CourseStatusTag status={course.status} />
        </Flex>
      </Flex>

      <Flex vertical gap={6} style={{ flex: 1 }}>
        <Text type="secondary" style={{ fontSize: 15 }}>
          {t('qualification.courses.col.credit')}: <Text strong>{course.creditHours}</Text>
        </Text>
        <Text type="secondary" style={{ fontSize: 15 }}>
          {t('qualification.courses.col.price')}:{' '}
          <Text strong>{course.price.toLocaleString('ru-RU')}</Text>
        </Text>
        <Flex align="center" gap={6} style={{ fontSize: 15, color: 'var(--color-text-soft, #697586)' }}>
          <CalendarOutlined />
          <span>
            {fmt(course.startDate)} — {fmt(course.endDate)}
          </span>
        </Flex>
        <Flex align="center" gap={6} style={{ fontSize: 15, color: 'var(--color-text-soft, #697586)' }}>
          <TeamOutlined />
          <span>
            {course.totalSubscribers}/{course.listenersLimit} {t('qualification.teacherCourses.listeners')}
          </span>
        </Flex>
      </Flex>

      <Button type="primary" block onClick={onEnter} style={{ height: 46, fontSize: 15 }}>
        {t('qualification.teacherCourses.enter')}
      </Button>
    </Card>
  );
}
