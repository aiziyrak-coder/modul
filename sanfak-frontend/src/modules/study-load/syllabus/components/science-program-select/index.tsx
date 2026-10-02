import { useField } from 'formik';
import { Form, Select, Tag, Tooltip } from 'antd';
import { useTranslation } from '@/shared/lib/i18n';
import type { ScienceProgramOption } from '../../model/types';

interface IProps {
  name: string;
  label: string;
  placeholder: string;
  options: ScienceProgramOption[];
}

const ScienceProgramSelect = ({ name, label, placeholder, options }: IProps) => {
  const { t } = useTranslation();
  const [field, meta, helpers] = useField<string>(name);
  const error = meta.touched && meta.error ? t(meta.error) : undefined;
  const blockedHint = t('syllabus.hint.v142NotSelectable');
  const hasBlocked = options.some((o) => o.isV142);

  const selectOptions = options.map((o) => ({
    value: o.value,
    disabled: o.disabled,
    title: o.isV142 ? `${o.label} — ${blockedHint}` : o.label,
    label: o.isV142 ? (
      <Tooltip title={blockedHint} placement="topLeft">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span>{o.label}</span>
          <Tag color="processing" style={{ margin: 0 }}>
            {t('studyLoad.scienceProgram.formVersionBadgeV142')}
          </Tag>
        </span>
      </Tooltip>
    ) : (
      o.label
    ),
  }));

  return (
    <Form.Item
      label={t(label)}
      required
      validateStatus={error ? 'error' : ''}
      help={error}
      extra={hasBlocked ? blockedHint : undefined}
    >
      <Select
        style={{ width: '100%' }}
        value={field.value ? field.value : undefined}
        options={selectOptions}
        placeholder={t(placeholder)}
        onChange={(value?: string) => { void helpers.setValue(value ?? ''); }}
        onBlur={() => { void helpers.setTouched(true); }}
        allowClear
        status={error ? 'error' : undefined}
      />
    </Form.Item>
  );
};

export default ScienceProgramSelect;
