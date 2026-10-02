import { useRef } from 'react';
import styled from 'styled-components';
import {
  UploadOutlined,
  FileOutlined,
  DownloadOutlined,
} from '@ant-design/icons';

const Wrap = styled.div<{
  $status: SmallUploadStatus;
  $disabled: boolean;
  $width?: string | number;
  $height?: string | number;
  $radius?: number;
}>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  width: ${({ $width }) => (typeof $width === 'number' ? `${$width}px` : ($width ?? 'auto'))};
  height: ${({ $height }) => (typeof $height === 'number' ? `${$height}px` : ($height ?? '44px'))};
  border-radius: ${({ $radius }) => ($radius ?? 8)}px;
  border: 1.5px ${({ $status }) => ($status === 'idle' ? 'dashed' : 'solid')}
    ${({ $status }) =>
      $status === 'success'
        ? 'var(--brand-primary, #37cb94)'
        : $status === 'error'
        ? 'var(--brand-error, #f04438)'
        : 'var(--color-border, #e3e8ef)'};
  background: ${({ $status }) =>
    $status === 'success' ? '#f0fdf9' : '#fff'};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.5 : 1)};
  transition: border-color 0.2s, background 0.2s;
  box-sizing: border-box;

  &:hover:not([disabled]) {
    border-color: var(--brand-primary, #37cb94);
  }

  &:focus-visible {
    outline: 2px solid var(--brand-primary, #37cb94);
    outline-offset: 2px;
  }
`;

const FileName = styled.span`
  flex: 1;
  font-size: 13px;
  color: var(--color-text, #121926);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
`;

const Placeholder = styled.span`
  font-size: 13px;
  color: var(--color-text-mute, #9aa3b2);
`;

const IconBox = styled.span<{ $success: boolean }>`
  font-size: 16px;
  color: ${({ $success }) =>
    $success ? 'var(--brand-primary, #37cb94)' : 'var(--color-text-soft, #697586)'};
  flex-shrink: 0;
`;

export type SmallUploadStatus = 'idle' | 'success' | 'error' | 'uploading';

export interface SmallUploadProps {
  value?: string | null;
  onFileSelect?: (file: File) => void;
  onOpenFile?: (url: string) => void;
  placeholder?: string;
  accept?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  disabled?: boolean;
  status?: SmallUploadStatus;
  download?: boolean;
  open?: boolean;
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.split(',').some((raw) => {
    const rule = raw.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

export function SmallUpload({
  value,
  onFileSelect,
  onOpenFile,
  placeholder = 'Fayl tanlash',
  accept,
  width,
  height,
  borderRadius,
  disabled = false,
  status = 'idle',
  download = false,
  open = false,
}: SmallUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const hasFile = !!value;

  const handleClick = () => {
    if (disabled) return;
    if (hasFile && (download || open) && value) {
      if (open) onOpenFile?.(value);
      else {
        const a = document.createElement('a');
        a.href = value;
        a.download = value.split('/').pop() ?? 'file';
        a.click();
      }
      return;
    }
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFileSelect?.(f);
    e.target.value = '';
  };

  const isDownloadMode = hasFile && (download || open) && !!value;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handleClick();
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled || isDownloadMode) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled || isDownloadMode) return;
    const f = e.dataTransfer.files?.[0];
    if (f && matchesAccept(f, accept)) onFileSelect?.(f);
  };

  const displayName = value
    ? value.split('/').pop()?.slice(0, 40) ?? value
    : null;

  const fullName = value ? (value.split('/').pop() ?? value) : null;
  const actionName = isDownloadMode ? 'Yuklab olish' : placeholder;
  const ariaLabel = fullName ? `${actionName}: ${fullName}` : actionName;

  const Icon = hasFile
    ? download
      ? DownloadOutlined
      : FileOutlined
    : UploadOutlined;

  return (
    <Wrap
      $status={status}
      $disabled={disabled}
      $width={width}
      $height={height}
      $radius={borderRadius}
      onClick={handleClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <IconBox $success={status === 'success'}>
        <Icon />
      </IconBox>
      {displayName ? (
        <FileName>{displayName}</FileName>
      ) : (
        <Placeholder>{placeholder}</Placeholder>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onClick={(e) => e.stopPropagation()}
        onChange={handleChange}
      />
    </Wrap>
  );
}
