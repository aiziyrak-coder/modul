import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useFormikContext } from 'formik';
import { TextField } from '@/shared/ui';
import { useTranslation } from '@/shared/lib/i18n';
import type { CodeTextInput, V142FormValues } from '../../model/types';
import { outcomeCode } from '../../lib/topic-code';
import CodeField from '../code-field';
import { FieldLabel, RepeaterList, RepeaterRow } from '../../style';

interface IProps {
  name: 'competencies' | 'skills';
  label: string;
  codeOffset?: number;
}

const CodeTextRepeater = ({ name, label, codeOffset = 0 }: IProps) => {
  const { t } = useTranslation();
  const { values, setFieldValue } = useFormikContext<V142FormValues>();
  const rows: CodeTextInput[] = values[name];

  const handleAdd = () => {
    void setFieldValue(name, [...rows, { code: '', text: '' }]);
  };
  const handleRemove = (idx: number) => {
    void setFieldValue(
      name,
      rows.filter((_, i) => i !== idx),
    );
  };

  return (
    <div>
      <FieldLabel>{t(label)}</FieldLabel>

      <RepeaterList>
        {rows.map((_, idx) => (
          <RepeaterRow key={idx}>
            <div style={{ width: 84 }}>
              <CodeField
                name={`${name}[${idx}].code`}
                autoCode={outcomeCode(codeOffset + idx + 1)}
                ariaLabel={t('scienceProgram.v142.field.outcomeCode')}
              />
            </div>
            <div style={{ flex: 1 }}>
              <TextField
                name={`${name}[${idx}].text`}
                placeholder="scienceProgram.v142.field.outcomeText"
              />
            </div>
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

      <Button type="dashed" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginTop: 12 }}>
        {t('studyLoad.common.add')}
      </Button>
    </div>
  );
};

export default CodeTextRepeater;
