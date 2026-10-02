import type { CSSProperties } from 'react';
import { WarningFilled } from '@ant-design/icons';
import styled from 'styled-components';

interface IProps {
  text: string;
  style?: CSSProperties;
}

const NoteContent = styled.div`
  display: flex;
  align-items: flex-start;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-3, 12px);
  background: rgba(239, 104, 32, 0.06);
  border-radius: var(--radius-md, 8px);

  p {
    margin: 0;
    font-weight: 500;
    font-size: 13px;
    line-height: 150%;
    color: var(--color-text-soft, #697586);
  }
`;

export const NoteBlock = ({ text, style }: IProps) => (
  <NoteContent style={style}>
    <WarningFilled style={{ color: '#EF6820', fontSize: 16, marginTop: 2, flexShrink: 0 }} />
    <p>{text}</p>
  </NoteContent>
);
