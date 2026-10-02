import { BorderOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { Empty, Spin } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import type { Option } from '../../model/course.types';
import { Count, ListWrap, Row } from './style';

interface IProps {
  options: Option[];
  value?: string[];
  onChange?: (value: string[]) => void;
  loading?: boolean;
}

export default function TeacherPicker({ options, value = [], onChange, loading }: IProps) {
  const { t } = useTranslation();

  const toggle = (id: string) => {
    onChange?.(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
        <Spin />
      </div>
    );
  }

  if (options.length === 0) {
    return <Empty description={t('qualification.courses.noTeachers')} />;
  }

  return (
    <>
      <ListWrap>
        {options.map((o) => {
          const selected = value.includes(o.value);
          return (
            <Row key={o.value} type="button" $selected={selected} onClick={() => toggle(o.value)}>
              {selected ? (
                <CheckSquareOutlined style={{ color: 'var(--brand-primary)', fontSize: 18 }} />
              ) : (
                <BorderOutlined style={{ color: 'var(--color-text-mute, #9aa3b2)', fontSize: 18 }} />
              )}
              <span>{o.label}</span>
            </Row>
          );
        })}
      </ListWrap>
      {value.length > 0 ? (
        <Count>{t('qualification.courses.teachersSelected', { count: value.length })}</Count>
      ) : null}
    </>
  );
}
