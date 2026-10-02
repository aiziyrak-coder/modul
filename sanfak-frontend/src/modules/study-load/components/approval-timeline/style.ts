import styled from 'styled-components';

const NARROW = '640px';

export const TimelineWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  padding: var(--space-4) 0;
  overflow-x: auto;

  @media (max-width: ${NARROW}) {
    flex-direction: column;
    overflow-x: visible;
  }
`;

export const StepItem = styled.div`
  flex: 1 1 0;
  min-width: 148px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  position: relative;
  padding: 0 var(--space-2);

  &:not(:last-child)::before {
    content: '';
    position: absolute;
    top: 11px;
    left: calc(50% + 16px);
    right: calc(-50% + 16px);
    height: 2px;
    background: var(--color-border, #e3e8ef);
  }

  @media (max-width: ${NARROW}) {
    flex-direction: row;
    align-items: flex-start;
    text-align: left;
    gap: var(--space-4);
    padding: 0;

    &:not(:last-child)::before {
      top: 24px;
      bottom: -8px;
      left: 11px;
      right: auto;
      width: 2px;
      height: auto;
    }
  }
`;

export const StepDot = styled.div<{ $status: 'pending' | 'approved' | 'rejected' }>`
  width: 24px;
  height: 24px;
  border-radius: var(--radius-pill);
  border: 2px solid
    ${({ $status }) =>
      $status === 'approved'
        ? 'var(--brand-primary)'
        : $status === 'rejected'
          ? 'var(--brand-error)'
          : 'var(--color-border)'};
  background: ${({ $status }) =>
    $status === 'approved'
      ? 'var(--brand-primary)'
      : $status === 'rejected'
        ? 'var(--brand-error)'
        : 'var(--color-bg-layout, #f5f7fb)'};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
`;

export const StepContent = styled.div`
  width: 100%;
  padding-top: var(--space-2);
  padding-bottom: var(--space-3);

  @media (max-width: ${NARROW}) {
    flex: 1;
    width: auto;
    padding-top: 0;
    padding-bottom: var(--space-5);
  }
`;

export const StepMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-top: var(--space-1);

  @media (max-width: ${NARROW}) {
    justify-content: flex-start;
  }
`;

export const RejectReason = styled.div`
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-layout, #f5f7fb);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--brand-error);
  text-align: left;
  overflow-wrap: anywhere;
`;
