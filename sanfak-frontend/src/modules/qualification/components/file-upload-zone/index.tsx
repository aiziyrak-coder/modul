import { useState } from 'react';
import { FileOutlined, UploadOutlined } from '@ant-design/icons';
import { Icon, Hint, MainText, Zone } from './style';

const HIDDEN_INPUT: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
};

interface IProps {
  dropText: string;
  hint?: string;
  maxText?: string;
  accept?: string;
  value?: string | null;
  onFileSelect: (file: File) => void;
}

export default function FileUploadZone({
  dropText,
  hint,
  maxText,
  accept,
  value,
  onFileSelect,
}: IProps) {
  const [drag, setDrag] = useState(false);
  const hasFile = !!value;

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFileSelect(f);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFileSelect(f);
    e.target.value = '';
  };

  return (
    <Zone
      $drag={drag}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <Icon>{hasFile ? <FileOutlined /> : <UploadOutlined />}</Icon>
      <MainText>{hasFile ? value : dropText}</MainText>
      {!hasFile && hint ? <Hint>{hint}</Hint> : null}
      {!hasFile && maxText ? <Hint>{maxText}</Hint> : null}
      <input type="file" accept={accept} onChange={handleChange} style={HIDDEN_INPUT} />
    </Zone>
  );
}
