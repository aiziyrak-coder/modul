import styled from 'styled-components';
import { FileTextOutlined, ExportOutlined } from '@ant-design/icons';

const Card = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--color-bg, #fff);
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-md, 8px);
`;

const FileIcon = styled.span`
  font-size: 20px;
  color: var(--color-text-soft, #697586);
  flex-shrink: 0;
`;

const Info = styled.div`
  flex: 1;
  min-width: 0;
`;

const CardTitle = styled.p`
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text, #121926);
`;

const FileName = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--color-text-soft, #697586);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const LinkBtn = styled.a`
  font-size: 18px;
  color: var(--color-text-soft, #697586);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  transition: color 0.2s;
  &:hover { color: var(--brand-primary, #37cb94); }
`;

export interface FileCardProps {
  title: string;
  fileName: string;
  link: string;
}

export function FileCard({ title, fileName, link }: FileCardProps) {
  return (
    <Card>
      <FileIcon><FileTextOutlined /></FileIcon>
      <Info>
        <CardTitle>{title}</CardTitle>
        <FileName>{fileName}</FileName>
      </Info>
      <LinkBtn href={link} target="_blank" rel="noopener noreferrer">
        <ExportOutlined />
      </LinkBtn>
    </Card>
  );
}
