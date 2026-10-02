import { useState } from 'react';
import { Button, Flex, SmallUpload } from '@/shared/ui';
import { MdClose } from '../../icons';

export interface FileUploadProps {
  accept?: string;
  onChange?: (file: File | null) => void;
}

export default function FileUpload({ accept = '.pdf,.docx,.jpg,.png', onChange }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null);

  const handleSelect = (f: File) => {
    setFile(f);
    onChange?.(f);
  };

  const handleRemove = () => {
    setFile(null);
    onChange?.(null);
  };

  return (
    <Flex align="center" gap="small">
      <SmallUpload
        accept={accept}
        placeholder="Bosing yoki fayl joylashtiring"
        value={file?.name ?? null}
        status={file ? 'success' : 'idle'}
        onFileSelect={handleSelect}
        width="100%"
      />
      {file && (
        <Button
          type="text"
          title="Olib tashlash"
          onClick={handleRemove}
          icon={<MdClose size={16} />}
        />
      )}
    </Flex>
  );
}
