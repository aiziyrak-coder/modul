import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import { useField } from 'formik';
import { useTranslation } from '@/shared/lib/i18n';
import { FieldLabel, RepeaterList, RepeaterRow } from '../../style';

interface IProps {
  name: 'knowledgeArea' | 'educationArea';
  label: string;
  placeholder: string;
}

const TextRowsRepeater = ({ name, label, placeholder }: IProps) => {
  const { t } = useTranslation();
  const [field, , helpers] = useField<string[]>(name);
  const values = Array.isArray(field.value) && field.value.length > 0 ? field.value : [''];

  const setAt = (idx: number, val: string) => {
    const next = [...values];
    next[idx] = val;
    void helpers.setValue(next);
  };

  return (
    <div>
      <FieldLabel>{t(label)}</FieldLabel>
      <RepeaterList>
        {values.map((val, idx) => (
          <RepeaterRow key={idx} style={{ alignItems: 'center' }}>
            <Input
              name={`${name}[${idx}]`}
              value={val}
              placeholder={t(placeholder)}
              onChange={(e) => setAt(idx, e.target.value)}
              style={{ flex: 1 }}
            />
            {idx === values.length - 1 ? (
              <Button
                type="link"
                aria-label={t('studyLoad.common.add')}
                icon={<PlusOutlined />}
                onClick={() => helpers.setValue([...values, ''])}
              />
            ) : (
              <Button
                type="text"
                danger
                aria-label={t('studyLoad.common.delete')}
                icon={<DeleteOutlined />}
                onClick={() => helpers.setValue(values.filter((_, i) => i !== idx))}
              />
            )}
          </RepeaterRow>
        ))}
      </RepeaterList>
    </div>
  );
};

export default TextRowsRepeater;
