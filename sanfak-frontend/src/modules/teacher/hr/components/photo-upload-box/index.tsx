import { useEffect, useRef, useState } from 'react';
import { PictureOutlined } from '@ant-design/icons';
import { useTranslation } from '@/shared/lib/i18n';
import { Box, Preview } from './style';

interface IProps {
  value: File | string | null;
  onChange: (file: File | null) => void;
}

const PhotoUploadBox = ({ value, onChange }: IProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    if (typeof value === 'string') {
      setPreview(value);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onChange(file);
    e.target.value = '';
  };

  return (
    <Box onClick={() => inputRef.current?.click()} role="button" tabIndex={0}>
      {preview ? (
        <Preview src={preview} alt="" />
      ) : (
        <>
          <PictureOutlined />
          <span>{t('teacher.hr.staff.form.uploadPhoto')}</span>
        </>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleChange} />
    </Box>
  );
};

export default PhotoUploadBox;
