import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useFormikContext } from 'formik';
import { TextAreaField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { SyllabusFormValues } from '../../model/types';
import { SectionLabel, TopicCard, TopicDeleteBtn } from '../../style';

const SkillsRepeater = () => {
  const { t } = useTranslation();
  const { values, setFieldValue } = useFormikContext<SyllabusFormValues>();
  const skills = values.skillOutcomes;

  const handleAdd = () => {
    void setFieldValue('skillOutcomes', [...skills, '']);
  };

  const handleRemove = (idx: number) => {
    const updated = skills.filter((_, i) => i !== idx);
    void setFieldValue('skillOutcomes', updated.length > 0 ? updated : ['']);
  };

  return (
    <div>
      <SectionLabel>{t('syllabus.field.skillOutcomes')}</SectionLabel>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {skills.map((_, idx) => (
          <TopicCard key={idx}>
            {skills.length > 1 ? (
              <TopicDeleteBtn
                type="button"
                title={t('studyLoad.common.delete')}
                onClick={() => handleRemove(idx)}
              >
                <DeleteOutlined />
              </TopicDeleteBtn>
            ) : null}

            <TextAreaField
              name={`skillOutcomes[${idx}]`}
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
        {t('syllabus.action.addSkill')}
      </Button>
    </div>
  );
};

export default SkillsRepeater;
