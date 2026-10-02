import styled from 'styled-components';

export const TableWrap = styled.div`
  .ant-table-wrapper {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .ant-table-thead > tr > th {
    background: var(--color-bg-table-head);
    color: var(--color-text-soft);
    font-weight: 500;
  }
  .ant-table-thead > tr > th::before {
    display: none;
  }
  .ant-table-tbody > tr > td {
    padding: var(--space-4) var(--space-3);
  }
  .hr-notif-unread > td {
    background: var(--brand-primary-soft) !important;
  }
`;

export const NotifCell = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
`;

export const NotifIcon = styled.div<{ $negative?: boolean }>`
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #fff;
  background: ${({ $negative }) => ($negative ? 'var(--brand-error)' : 'var(--brand-primary)')};
`;

export const NotifTextCol = styled.div`
  min-width: 0;
`;

export const NotifTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text);
`;

export const NotifBody = styled.div`
  font-size: 12px;
  color: var(--color-text-soft);
  margin-top: 2px;
`;

export const EmptyWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) 0;
  background: var(--color-bg);
  border-radius: var(--radius-lg);
`;

export const EmptyIconWrap = styled.div`
  position: relative;
  display: inline-flex;
  margin-bottom: var(--space-4);
`;

export const EmptyBadge = styled.div`
  position: absolute;
  top: -4px;
  right: -8px;
  min-width: 28px;
  height: 28px;
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-text);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const EmptyText = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-soft);
`;
