import type { InputNumberProps } from 'antd';
import { InputNumber } from '@/shared/ui';
import { parseDecimalInput } from './parse-decimal-input';

export type NumberFieldProps = Omit<InputNumberProps, 'parser'>;

export function NumberField(props: NumberFieldProps) {
  return <InputNumber {...props} parser={parseDecimalInput} />;
}
