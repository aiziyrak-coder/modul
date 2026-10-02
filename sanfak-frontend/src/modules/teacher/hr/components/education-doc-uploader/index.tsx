import { useRef } from 'react';
import { DeleteOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import type { StaffDegreeDocument } from '../../model/staff-types';
import { AddBtn, FileName, IconBox, Placeholder, Row, TrashBtn, Wrap } from './style';

interface IProps {
  existing: StaffDegreeDocument[];
  pending: File[];
  onPendingChange: (files: File[]) => void;
  placeholder: string;
  maxCount?: number;
}

const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png';

const EducationDocUploader = ({
  existing,
  pending,
  onPendingChange,
  placeholder,
  maxCount = 10,
}: IProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const totalCount = existing.length + pending.length;
  const canAddMore = totalCount < maxCount;

  const openPicker = () => inputRef.current?.click();

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) {
      const room = Math.max(maxCount - totalCount, 0);
      onPendingChange([...pending, ...files.slice(0, room)]);
    }
    e.target.value = '';
  };

  const removePending = (idx: number) => {
    onPendingChange(pending.filter((_, i) => i !== idx));
  };

  return (
    <Wrap>
      {existing.map((doc, idx) => (
        <Row key={`existing-${doc.path}-${idx}`}>
          <IconBox>
            <UploadOutlined />
          </IconBox>
          <FileName title={doc.title}>{doc.title}</FileName>
        </Row>
      ))}

      {pending.map((file, idx) => (
        <Row key={`pending-${file.name}-${idx}`}>
          <IconBox>
            <UploadOutlined />
          </IconBox>
          <FileName title={file.name}>{file.name}</FileName>
          <TrashBtn type="button" onClick={() => removePending(idx)} aria-label="remove">
            <DeleteOutlined />
          </TrashBtn>
        </Row>
      ))}

      {canAddMore ? (
        <Row $empty>
          <IconBox>
            <UploadOutlined />
          </IconBox>
          <Placeholder type="button" onClick={openPicker}>
            {placeholder}
          </Placeholder>
          <AddBtn type="button" onClick={openPicker} aria-label="add">
            <PlusOutlined />
          </AddBtn>
        </Row>
      ) : null}

      <input ref={inputRef} type="file" multiple hidden accept={ACCEPT} onChange={handleFiles} />
    </Wrap>
  );
};

export default EducationDocUploader;
