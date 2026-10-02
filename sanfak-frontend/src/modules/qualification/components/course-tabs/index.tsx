import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Flex } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import { EDU_FORM } from '../../model/course.types';
import type { EduForm } from '../../model/course.types';

interface IProps {
  courseId: string;
  form?: EduForm;
}

export default function CourseTabs({ courseId, form }: IProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const base = `/qualification/teacher/courses/${courseId}`;

  const tabs = [
    { key: 'entrance-test', label: t('qualification.courseTabs.entrance') },
    ...(form === EDU_FORM.ONLINE
      ? [{ key: 'materials', label: t('qualification.courseTabs.materials') }]
      : []),
    { key: 'exit-test', label: t('qualification.courseTabs.exit') },
  ];

  return (
    <Flex
      gap={4}
      style={{ borderBottom: '1px solid var(--color-border)', marginBottom: 'var(--space-4)' }}
    >
      {tabs.map((tb) => {
        const active = pathname.endsWith(`/${tb.key}`);
        return (
          <Button
            key={tb.key}
            type="text"
            onClick={() => navigate(`${base}/${tb.key}`)}
            style={{
              height: 44,
              borderRadius: 0,
              borderBottom: `2px solid ${active ? 'var(--brand-primary, #37cb94)' : 'transparent'}`,
              color: active ? 'var(--brand-primary, #37cb94)' : 'var(--color-text-soft, #697586)',
              fontWeight: active ? 600 : 400,
            }}
          >
            {tb.label}
          </Button>
        );
      })}
    </Flex>
  );
}
