import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Col, Row, Tooltip } from 'antd';
import { useFormikContext } from 'formik';
import { NumberField, SelectField, TextField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { V142FormValues } from '../../model/types';
import { renumberTopicCodes } from '../../lib/topic-code';
import { EMPTY_TOPIC, TOPIC_TYPE_OPTION_KEYS } from '../../lib/v142-defaults';
import CodeField from '../code-field';
import { FieldLabel, RepeaterList, RepeaterRow } from '../../style';

const TopicsByTypeRepeater = () => {
  const { t } = useTranslation();
  const { values, setFieldValue } = useFormikContext<V142FormValues>();
  const topics = values.topics;
  const numbered = renumberTopicCodes(topics);

  const typeOptions = TOPIC_TYPE_OPTION_KEYS.map((o) => ({ label: t(o.labelKey), value: o.value }));

  const handleAdd = () => {
    void setFieldValue('topics', [...topics, { ...EMPTY_TOPIC }]);
  };

  const handleRemove = (idx: number) => {
    void setFieldValue(
      'topics',
      topics.filter((_, i) => i !== idx),
    );
  };

  return (
    <div>
      <FieldLabel>{t('scienceProgram.v142.section.lessons')}</FieldLabel>

      {topics.length === 0 ? (
        <div style={{ color: 'var(--color-text-soft, #697586)', marginBottom: 12 }}>
          {t('scienceProgram.v142.topic.empty')}
        </div>
      ) : null}

      <RepeaterList>
        {topics.map((_, idx) => (
          <RepeaterRow key={idx} data-testid={`topic-row-${idx}`}>
            <Row gutter={[12, 8]} style={{ flex: 1 }} align="top">
              <Col xs={6} sm={3} md={2}>
                <Tooltip title={t('scienceProgram.v142.topic.codeEditable')}>
                  <div>
                    <CodeField
                      name={`topics[${idx}].code`}
                      autoCode={numbered[idx]?.code ?? ''}
                      ariaLabel={t('scienceProgram.v142.topic.code')}
                    />
                  </div>
                </Tooltip>
              </Col>
              <Col xs={18} sm={9} md={5}>
                <SelectField
                  name={`topics[${idx}].type`}
                  placeholder="scienceProgram.v142.topic.type"
                  options={typeOptions}
                />
              </Col>
              <Col xs={24} sm={12} md={10}>
                <TextField
                  name={`topics[${idx}].title`}
                  placeholder="scienceProgram.v142.topic.titlePlaceholder"
                />
              </Col>
              <Col xs={10} sm={5} md={3}>
                <NumberField name={`topics[${idx}].hours`} min={0} max={999} />
              </Col>
              <Col xs={14} sm={7} md={4}>
                <TextField
                  name={`topics[${idx}].refs`}
                  placeholder="scienceProgram.v142.topic.refsPlaceholder"
                />
              </Col>
            </Row>

            <Button
              type="text"
              danger
              aria-label={t('studyLoad.common.delete')}
              icon={<DeleteOutlined />}
              onClick={() => handleRemove(idx)}
              style={{ height: 44 }}
            />
          </RepeaterRow>
        ))}
      </RepeaterList>

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        style={{ marginTop: 12 }}
      >
        {t('scienceProgram.v142.topic.addTopic')}
      </Button>
    </div>
  );
};

export default TopicsByTypeRepeater;
