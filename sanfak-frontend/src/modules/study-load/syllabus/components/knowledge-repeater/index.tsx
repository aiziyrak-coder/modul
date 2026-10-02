import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useFormikContext } from 'formik';
import { TextAreaField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { SyllabusFormValues } from '../../model/types';
import { FieldLabel, TopicCard, TopicDeleteBtn } from '../../style';

const KnowledgeRepeater = () => {
  const { t } = useTranslation();
  const { values, setFieldValue } = useFormikContext<SyllabusFormValues>();
  const items = values.knowledgeOutcomes;

  const handleAdd = () => {
    void setFieldValue('knowledgeOutcomes', [...items, '']);
  };

  const handleRemove = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx);
    void setFieldValue('knowledgeOutcomes', updated.length > 0 ? updated : ['']);
  };

  return (
    <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
      <FieldLabel>{t('syllabus.field.knowledgeOutcomes')}</FieldLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

            <TextAreaField
              name={`knowledgeOutcomes[${idx}]`}
              label={undefined}
              placeholder="syllabus.field.textareaPlaceholder"
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
        {t('syllabus.action.addKnowledge')}
      </Button>
    </div>
  );
};

export default KnowledgeRepeater;
