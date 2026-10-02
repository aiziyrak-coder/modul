import { useRef, useState, useEffect } from 'react';
import styled from 'styled-components';
import { UserOutlined, CameraOutlined } from '@ant-design/icons';
import { Avatar } from 'antd';

const Wrap = styled.div`
  position: relative;
  display: inline-block;
`;

const UploadBtn = styled.button`
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: var(--brand-primary, #37cb94);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.2s;

  &:hover { background: var(--brand-primary-hover, #30b583); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export interface AvatarUploadProps {
  file?: File | string | null;
  setFile?: (file: File | null) => void;
  disabled?: boolean;
  size?: number;
}

export function AvatarUpload({ file, setFile, disabled = false, size = 80 }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    if (typeof file === 'string') { setPreview(file); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile?.(f);
  };

  return (
    <Wrap>
      <Avatar
        size={size}
        src={preview ?? undefined}
        icon={!preview ? <UserOutlined /> : undefined}
        style={{ background: preview ? undefined : 'var(--color-border-soft, #eef2f6)', color: 'var(--color-text-soft)' }}
      />
      <UploadBtn
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <CameraOutlined />
      </UploadBtn>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleChange}
      />
    </Wrap>
  );
}
