import styled, { css } from 'styled-components';

export const Page = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;

  > *:not(:last-child) {
    flex-shrink: 0;
  }
`;

export const stickyFooterCard = css`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  > .ant-table-wrapper {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
`;

export const TableCard = styled.div`
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border-secondary, #e5e7eb);
  border-radius: var(--radius-lg, 14px);
  ${stickyFooterCard}
`;

export const Wrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4, 16px);
  padding: var(--space-3, 12px) var(--space-5, 20px);
  border-top: 1px solid var(--border-secondary, #eef0f3);
  background: var(--bg-surface, #fff);

  .ant-pagination {
    margin: 0;
  }

  .ant-pagination-item {
    width: 32px;
    height: 32px;
    line-height: 32px;
    border-radius: var(--radius-md, 8px);

    a {
      font-size: 14px;
    }

    &:hover {
      border-color: var(--brand-primary, #37cb94);

      a {
        color: var(--brand-primary, #37cb94);
      }
    }
  }

  .ant-pagination-item-active {
    background-color: var(--bg-surface, #fff);
    border-color: var(--brand-primary, #37cb94);

    a {
      color: var(--brand-primary, #37cb94);
    }
  }

  .ant-pagination-prev,
  .ant-pagination-next {
    width: 32px;
    height: 32px;
    line-height: 32px;
  }

  .ant-pagination-item-link {
    line-height: 32px;
  }

  .ant-pagination-prev:hover .ant-pagination-item-link,
  .ant-pagination-next:hover .ant-pagination-item-link {
    border-color: var(--brand-primary, #37cb94);
    color: var(--brand-primary, #37cb94);
  }
`;

export const SizeBox = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  height: 32px;

  .label {
    font-size: 14px;
    color: var(--color-text, #121926);
    padding-right: var(--space-1, 4px);
  }
`;

export const SizeBtn = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border-radius: var(--radius-md, 8px);
  font-size: 14px;
  cursor: pointer;
  transition: all ease 250ms;
  border: 1px solid ${({ $active }) => ($active ? 'var(--brand-primary, #37cb94)' : 'transparent')};
  color: ${({ $active }) => ($active ? 'var(--brand-primary, #37cb94)' : 'var(--color-text, #121926)')};

  &:hover {
    border-color: var(--brand-primary, #37cb94);
    color: var(--brand-primary, #37cb94);
  }
`;
