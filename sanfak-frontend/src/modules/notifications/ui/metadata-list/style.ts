import styled from 'styled-components';

export const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
`;

export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
`;

export const FieldRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  font-size: 13px;

  > :first-child {
    flex: none;
    min-width: 120px;
  }
  > :last-child {
    min-width: 0;
    overflow-wrap: anywhere;
  }
`;

export const ArrayList = styled.ul`
  margin: 0;
  padding-left: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const IdWrap = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
`;

export const ObjectPre = styled.pre`
  margin: 0;
  padding: var(--space-2);
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;
