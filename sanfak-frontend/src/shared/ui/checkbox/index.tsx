import { memo, type KeyboardEvent, type ReactNode } from 'react';
import styled from 'styled-components';
import { CheckOutlined } from '@ant-design/icons';

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  size?: number;
  radius?: number;
  reverse?: boolean;
  onChange?: (checked: boolean) => void;
  children?: ReactNode;
  color?: string;
}

const Wrap = styled.label<{ $reverse: boolean; $disabled: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  flex-direction: ${({ $reverse }) => ($reverse ? 'row-reverse' : 'row')};
  user-select: none;

  &:focus-visible {
    outline: 2px solid var(--brand-primary, #37cb94);
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

const Box = styled.span<{
  $checked: boolean;
  $indeterminate: boolean;
  $size: number;
  $radius: number;
  $color: string;
}>`
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: ${({ $radius }) => $radius}px;
  border: 1.5px solid
    ${({ $checked, $indeterminate, $color }) =>
      $checked || $indeterminate ? $color : 'var(--color-border, #e3e8ef)'};
  background: ${({ $checked, $indeterminate, $color }) =>
    $checked || $indeterminate ? $color : '#fff'};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s ease;
  position: relative;

  .anticon {
    color: #fff;
    font-size: ${({ $size }) => Math.round($size * 0.65)}px;
  }
`;

const Indeterminate = styled.span<{ $size: number }>`
  width: ${({ $size }) => Math.round($size * 0.55)}px;
  height: 2px;
  border-radius: 1px;
  background: #fff;
`;

const LabelText = styled.span`
  font-size: 14px;
  color: var(--color-text, #121926);
`;

export const Checkbox = memo(function Checkbox({
  checked = false,
  indeterminate = false,
  disabled = false,
  size = 18,
  radius = 4,
  reverse = false,
  onChange,
  children,
  color = 'var(--brand-primary, #37cb94)',
}: CheckboxProps) {
  const interactive = typeof onChange === 'function';

  const handleClick = () => {
    if (!disabled) onChange?.(!checked);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLLabelElement>) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      onChange?.(!checked);
    }
  };

  return (
    <Wrap
      $reverse={reverse}
      $disabled={disabled}
      onClick={handleClick}
      role={interactive ? 'checkbox' : undefined}
      tabIndex={interactive ? (disabled ? -1 : 0) : undefined}
      aria-checked={interactive ? (indeterminate ? 'mixed' : checked) : undefined}
      aria-disabled={interactive && disabled ? true : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      <Box
        $checked={checked}
        $indeterminate={indeterminate}
        $size={size}
        $radius={radius}
        $color={color}
      >
        {indeterminate ? (
          <Indeterminate $size={size} />
        ) : checked ? (
          <CheckOutlined />
        ) : null}
      </Box>
      {children && <LabelText>{children}</LabelText>}
    </Wrap>
  );
});
