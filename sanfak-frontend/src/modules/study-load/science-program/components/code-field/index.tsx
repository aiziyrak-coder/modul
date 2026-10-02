import { Form, Input } from 'antd';
import { useField } from 'formik';

interface IProps {
  name: string;
  autoCode: string;
  ariaLabel: string;
}

const CodeField = ({ name, autoCode, ariaLabel }: IProps) => {
  const [field, , helpers] = useField<string>(name);
  return (
    <Form.Item style={{ marginBottom: 0 }}>
      <Input
        aria-label={ariaLabel}
        value={field.value ?? ''}
        placeholder={autoCode || '—'}
        maxLength={8}
        onChange={(e) => helpers.setValue(e.target.value)}
        onBlur={() => helpers.setTouched(true)}
        style={{ textAlign: 'center', fontWeight: 600 }}
      />
    </Form.Item>
  );
};

export default CodeField;
