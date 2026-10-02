import type { CSSProperties } from 'react';
import { Input } from 'antd';
import type { TextAreaProps } from 'antd/es/input';

interface Props extends Omit<TextAreaProps, 'onChange'> {
  label?: string;
  onChange?: (value: string) => void;
  maxWidth?: string | number;
  widthWrap?: string | number;
  wrapHeight?: string | number;
  labelStyle?: CSSProperties;
}

export function Textarea({
  label,
  onChange,
  maxWidth,
  widthWrap,
  wrapHeight,
  labelStyle,
  style,
  ...rest
}: Props) {
  return (
    <div style={{ maxWidth: widthWrap, height: wrapHeight }}>
      {label && (
        <label
          style={{
            display: 'block',
            marginBottom: 6,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text, #121926)',
            ...labelStyle,
          }}
        >
          {label}
        </label>
      )}
      <Input.TextArea
        onChange={(e) => onChange?.(e.target.value)}
        style={{ maxWidth, ...style }}
        {...rest}
      />
    </div>
  );
}
