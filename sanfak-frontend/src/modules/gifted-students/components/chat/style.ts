import styled from 'styled-components';

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: white;
  border-radius: 12px;
  overflow: hidden;
`;

export const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid #e8ecef;
  flex-shrink: 0;
`;

export const Avatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--brand-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
`;

export const HeadName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
`;

export const HeadStatus = styled.div<{ $online: boolean }>`
  font-size: 11px;
  color: ${({ $online }) => ($online ? 'var(--brand-primary)' : '#95a5a6')};
`;

export const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #f9fafb;
  min-height: 0;
`;

export const LoadingOlder = styled.div`
  text-align: center;
  font-size: 11px;
  color: #7f8c8d;
  padding: 6px 0;
`;

export const DateLabel = styled.div`
  text-align: center;
  font-size: 11px;
  color: #7f8c8d;
  background: #e8ecef;
  padding: 3px 10px;
  border-radius: 999px;
  width: fit-content;
  margin: 12px auto;
`;

export const Row = styled.div<{ $mine: boolean }>`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  justify-content: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
  margin-bottom: 8px;
`;

export const MsgAvatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--brand-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
`;

export const Bubble = styled.div<{ $mine: boolean }>`
  max-width: 70%;
  padding: 10px 14px;
  border-radius: ${({ $mine }) => ($mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px')};
  background: ${({ $mine }) => ($mine ? 'var(--brand-primary)' : 'white')};
  color: ${({ $mine }) => ($mine ? 'white' : '#2c3e50')};
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
`;

export const Text = styled.p`
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;

export const Meta = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
  margin-top: 4px;
`;

export const Time = styled.span`
  font-size: 10px;
  opacity: 0.65;
`;

export const PillDock = styled.div`
  position: relative;
  height: 0;
  flex-shrink: 0;
`;

export const NewBelowPill = styled.button`
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  z-index: 2;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--brand-primary);
  color: white;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  &:hover {
    background: var(--brand-primary-hover);
  }
`;

export const Composer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid #e8ecef;
  background: white;
  flex-shrink: 0;
`;

export const InputWrap = styled.div`
  flex: 1;
  min-width: 0;
`;

export const SendBtn = styled.button`
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--brand-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
  transition: all 0.15s;
  &:hover:not(:disabled) {
    background: var(--brand-primary-hover);
  }
  &:disabled {
    opacity: 0.4;
  }
`;

export const EmptyState = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  color: #7f8c8d;
  font-size: 13px;
`;

export const Notice = styled.div`
  margin: auto;
  padding: 24px;
  text-align: center;
  color: #7f8c8d;
  font-size: 13px;
`;

export const ErrorNotice = styled.div`
  margin: 8px auto;
  padding: 10px 14px;
  border-radius: 8px;
  background: #fdecea;
  color: #c0392b;
  font-size: 12px;
  text-align: center;
  max-width: 90%;
`;

export const FileChip = styled.a<{ $mine: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  text-decoration: none;
  background: ${({ $mine }) => ($mine ? 'rgba(255, 255, 255, 0.22)' : '#eef2f5')};
  color: ${({ $mine }) => ($mine ? '#fff' : '#2c3e50')};
  &:hover {
    text-decoration: underline;
  }
`;
