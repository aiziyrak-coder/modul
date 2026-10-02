import { UploadOutlined, FileOutlined } from '@ant-design/icons';
import { Wrap, FileName, Placeholder, IconBox, type FilePickerStatus } from './style';

const HIDDEN_INPUT: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
};

export type { FilePickerStatus };

export interface FilePickerProps {
  value?: string | null;
  onFileSelect: (file: File) => void;
  placeholder?: string;
  accept?: string;
  width?: string | number;
  disabled?: boolean;
  status?: FilePickerStatus;
}

export default function FilePicker({
  value,
  onFileSelect,
  placeholder = 'Fayl tanlash',
  accept,
  width,
  disabled = false,
  status = 'idle',
}: FilePickerProps) {
  const hasFile = !!value;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFileSelect(f);
    e.target.value = '';
  };

  return (
    <Wrap $status={status} $disabled={disabled} $width={width}>
      <IconBox $success={status === 'success'}>
        {hasFile ? <FileOutlined /> : <UploadOutlined />}
      </IconBox>
      {hasFile ? <FileName>{value}</FileName> : <Placeholder>{placeholder}</Placeholder>}
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        style={HIDDEN_INPUT}
      />
    </Wrap>
  );
}
