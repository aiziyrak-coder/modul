import styled from 'styled-components';

export type FilePickerStatus = 'idle' | 'success' | 'error';

export const Wrap = styled.label<{
  $status: FilePickerStatus;
  $disabled: boolean;
  $width?: string | number;
}>`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  width: ${({ $width }) => (typeof $width === 'number' ? `${$width}px` : ($width ?? 'auto'))};
  height: var(--ant-control-height-lg, 50px);
  border-radius: 8px;
  border: 1.5px ${({ $status }) => ($status === 'idle' ? 'dashed' : 'solid')}
    ${({ $status }) =>
      $status === 'success'
        ? 'var(--brand-primary, #37cb94)'
        : $status === 'error'
          ? 'var(--brand-error, #f04438)'
          : 'var(--color-border, #e3e8ef)'};
  background: ${({ $status }) => ($status === 'success' ? '#f0fdf9' : '#fff')};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  transition:
    border-color 0.2s,
    background 0.2s;
  box-sizing: border-box;

  &:hover {
    border-color: var(--brand-primary, #37cb94);
  }
`;

export const FileName = styled.span`
  flex: 1;
  font-size: 13px;
  color: var(--color-text, #121926);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const Placeholder = styled.span`
  flex: 1;
  font-size: 13px;
  color: var(--color-text-mute, #9aa3b2);
`;

export const IconBox = styled.span<{ $success: boolean }>`
  display: inline-flex;
  font-size: 16px;
  flex-shrink: 0;
  color: ${({ $success }) =>
    $success ? 'var(--brand-primary, #37cb94)' : 'var(--color-text-soft, #697586)'};
`;
