import styled from 'styled-components';
import { WarningOutlined, InfoCircleOutlined } from '@ant-design/icons';

const Wrap = styled.div<{ $warning: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-radius: var(--radius-md, 8px);
  background: ${({ $warning }) => ($warning ? '#fffaeb' : '#eff8ff')};
  border: 1px solid ${({ $warning }) => ($warning ? '#fec84b' : '#b2ddff')};
`;

const Icon = styled.span<{ $warning: boolean }>`
  font-size: 16px;
  color: ${({ $warning }) => ($warning ? '#b54708' : '#1570ef')};
  margin-top: 1px;
  flex-shrink: 0;
`;

const TextWrap = styled.div``;

const NoteTitle = styled.p`
  margin: 0 0 2px;
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text, #121926);
`;

const NoteText = styled.p`
  margin: 0;
  font-size: 13px;
  color: var(--color-text-soft, #697586);
`;

export interface NoteProps {
  title?: string;
  text: string;
  warning?: boolean;
  margin?: string;
}

export function Note({ title, text, warning = false, margin }: NoteProps) {
  return (
    <Wrap $warning={warning} style={margin ? { margin } : undefined}>
      <Icon $warning={warning}>
        {warning ? <WarningOutlined /> : <InfoCircleOutlined />}
      </Icon>
      <TextWrap>
        {title && <NoteTitle>{title}</NoteTitle>}
        <NoteText>{text}</NoteText>
      </TextWrap>
    </Wrap>
  );
}
