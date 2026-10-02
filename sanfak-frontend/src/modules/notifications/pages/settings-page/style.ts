import styled from 'styled-components';

export const PageWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 860px;
`;

export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
`;

export const Section = styled.section`
  background: var(--color-bg-elevate);
  border-radius: var(--radius-md);
  padding: var(--space-4);
`;

export const SectionTitle = styled.h3`
  margin: 0 0 var(--space-2);
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
`;

export const SectionHint = styled.p`
  margin: 0 0 var(--space-3);
  font-size: 13px;
  color: var(--color-text-soft);
`;

export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;

  & + & {
    margin-top: var(--space-3);
  }
`;

export const DigestControls = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-3);
`;

export const EventRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-2) 0;
  flex-wrap: wrap;

  & + & {
    border-top: 1px solid var(--color-border);
  }

  .name {
    font-size: 13px;
    color: var(--color-text);
    overflow-wrap: anywhere;
  }
`;

export const ChannelGroup = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
`;

export const ChannelHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-bottom: var(--space-2);

  span {
    font-size: 12px;
    color: var(--color-text-soft);
  }
`;

export const SaveBar = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  position: sticky;
  bottom: 0;
  padding: var(--space-3) 0;
  background: var(--color-bg);
`;
