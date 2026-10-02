import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Button, Col, Row } from 'antd';
import { useFormikContext } from 'formik';
import { NumberField, TextAreaField, TextField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { ScienceProgramFormValues, TopicInput } from '../../model/types';
import { TopicCard, TopicDeleteBtn, SectionLabel } from '../../style';

interface IProps {
  fieldName?: string;
}

const TopicsRepeater = ({ fieldName = 'topics' }: IProps) => {
  const { t } = useTranslation();
  const { values, setFieldValue } = useFormikContext<ScienceProgramFormValues>();
  const topics: TopicInput[] = values.topics;

  const handleAdd = () => {
    const next: TopicInput = { order: topics.length + 1, title: '', desc: '' };
    void setFieldValue(fieldName, [...topics, next]);
  };

  const handleRemove = (idx: number) => {
    const updated = topics
      .filter((_, i) => i !== idx)
      .map((t, i) => ({ ...t, order: i + 1 }));
    void setFieldValue(fieldName, updated);
  };

  return (
    <div>
      <SectionLabel>{t('scienceProgram.section.topics')}</SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {topics.map((_, idx) => (
          <TopicCard key={idx}>
            {topics.length > 1 ? (
              <TopicDeleteBtn
                type="button"
                title={t('studyLoad.common.delete')}
                onClick={() => handleRemove(idx)}
              >
                <DeleteOutlined />
              </TopicDeleteBtn>
            ) : null}

            <Row gutter={[16, 0]} align="middle">
              <Col xs={24} sm={4} md={3}>
                <NumberField
                  name={`${fieldName}[${idx}].order`}
                  label="scienceProgram.topic.order"
                  min={1}
                />
              </Col>
              <Col xs={24} sm={20} md={21}>
                <TextField
                  name={`${fieldName}[${idx}].title`}
                  label="scienceProgram.topic.title"
                  placeholder="scienceProgram.topic.titlePlaceholder"
                />
              </Col>
            </Row>

            <TextAreaField
              name={`${fieldName}[${idx}].desc`}
              label="scienceProgram.topic.desc"
              placeholder="scienceProgram.topic.descPlaceholder"
              rows={3}
            />
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

export default TopicsRepeater;
