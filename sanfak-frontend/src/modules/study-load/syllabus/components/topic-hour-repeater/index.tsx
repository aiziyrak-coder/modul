import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Button, Col, Row } from 'antd';
import { useFormikContext } from 'formik';
import { SelectField, NumberField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { SyllabusFormValues, TopicHourItem } from '../../model/types';
import { SectionLabel, TopicCard, TopicDeleteBtn } from '../../style';

interface IProps {
  fieldName: 'lectures' | 'seminars' | 'independentWorks';
  label: string;
  topicOptions?: { label: string; value: string }[];
}

const TopicHourRepeater = ({ fieldName, label, topicOptions = [] }: IProps) => {
  const { t } = useTranslation();
  const { values, setFieldValue } = useFormikContext<SyllabusFormValues>();
  const items: TopicHourItem[] = values[fieldName];

  const handleAdd = () => {
    void setFieldValue(fieldName, [...items, { topic: '', hour: 0 }]);
  };

  const handleRemove = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx);
    void setFieldValue(fieldName, updated.length > 0 ? updated : [{ topic: '', hour: 0 }]);
  };

  return (
    <div>
      <SectionLabel>{t(label)}</SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((_, idx) => (
          <TopicCard key={idx}>
            {items.length > 1 ? (
              <TopicDeleteBtn
                type="button"
                title={t('studyLoad.common.delete')}
                onClick={() => handleRemove(idx)}
              >
                <DeleteOutlined />
              </TopicDeleteBtn>
            ) : null}

            <Row gutter={[16, 0]} align="bottom">
              <Col xs={24} sm={18} md={19}>
                <SelectField
                  name={`${fieldName}[${idx}].topic`}
                  label="syllabus.field.topic"
                  placeholder="syllabus.field.selectTopicPlaceholder"
                  options={topicOptions}
                />
              </Col>
              <Col xs={24} sm={6} md={5}>
                <NumberField
                  name={`${fieldName}[${idx}].hour`}
                  label="syllabus.field.hour"
                  min={0}
                />
              </Col>
            </Row>
          </TopicCard>
        ))}
      </div>

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        style={{ marginTop: 12 }}
      >
        {t('studyLoad.common.add')}
      </Button>
    </div>
  );
};

export default TopicHourRepeater;
