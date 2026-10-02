import styled from 'styled-components';

export const DataTableRoot = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

export const TableScrollArea = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: auto;
`;

export const PaginationWrapper = styled.div`
  display: flex;
  background-color: var(--color-bg, #fff);
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4, 16px) var(--space-5, 20px);
  box-sizing: border-box;
  border-top: 1px solid var(--color-border, #e3e8ef);
  flex-wrap: wrap;
  gap: var(--space-5, 20px);
  flex-shrink: 0;

  margin: 0 calc(-1 * var(--content-body-padding, 24px))
    calc(-1 * var(--content-body-padding, 24px));

  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
  z-index: 5;

  .ant-pagination-item {
    width: 32px;
    height: 32px;
    line-height: 32px;
    border-radius: var(--radius-md, 8px);

    a {
      color: var(--color-text, #121926);
      font-size: 14px;
    }

    &:hover {
      border: 1px solid var(--brand-primary, #37cb94);
      background: var(--color-bg, #fff) !important;

      a {
        color: var(--brand-primary, #37cb94);
      }
    }
  }

  .ant-pagination-item-active {
    background-color: var(--color-bg, #fff);
    border: 1px solid var(--brand-primary, #37cb94);

    a {
      color: var(--brand-primary, #37cb94);
    }
  }

  .ant-pagination-prev,
  .ant-pagination-next {
    line-height: 32px;
    background-color: var(--color-bg, #fff);
    width: 32px;
    height: 32px;
  }

  .ant-pagination-item-link {
    box-sizing: border-box;
    background-color: var(--color-bg, #fff);
    border-radius: var(--radius-md, 8px);
    outline: none;
    line-height: 32px;
    border: none;
  }

  .ant-pagination-prev:hover .ant-pagination-item-link,
  .ant-pagination-next:hover .ant-pagination-item-link {
    border: 1px solid var(--brand-primary, #37cb94);
    border-radius: var(--radius-md, 8px);
    background-color: var(--color-bg, #fff);
  }

  .ant-pagination-prev:hover svg,
  .ant-pagination-next:hover svg {
    fill: var(--brand-primary, #37cb94);
  }

  .ant-select.ant-select-outlined {
    border: none;
  }
`;

export const SizeContainer = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  height: 32px;

  h5 {
    font-weight: 400;
    font-size: 14px;
    line-height: 100%;
    color: var(--color-text, #121926);
    padding-right: var(--space-1, 4px);
    margin: 0;
  }
`;

export const SizeButton = styled.span<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md, 8px);
  transition: all ease 250ms;
  font-weight: 400;
  font-size: 14px;
  line-height: 100%;
  cursor: pointer;
  border: ${({ $active }) =>
    $active
      ? '1px solid var(--brand-primary, #37cb94)'
      : '1px solid transparent'};
  color: ${({ $active }) =>
    $active
      ? 'var(--brand-primary, #37cb94)'
      : 'var(--color-text, #121926)'};

  &:hover {
    border: 1px solid var(--brand-primary, #37cb94);
    color: var(--brand-primary, #37cb94);
  }
`;

export const TableWrapper = styled.div<{ $hasPagination?: boolean }>`
  width: 100%;
  box-sizing: border-box;
  border-radius: var(--radius-lg, 12px);
  background: var(--color-bg, #fff);
  border: 1px solid var(--color-border, #e3e8ef);
  overflow: hidden;
  padding: 4px;
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-family: Inter, sans-serif;
  font-size: 14px;
`;

export const Th = styled.th<{ $align?: 'left' | 'center' | 'right' }>`
  text-align: ${({ $align }) => $align ?? 'left'};
  padding: 13px;
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
  background: var(--color-bg-table-head, #eef2f6);
  color: var(--color-text-soft, #697586);
  border-bottom: none;

  &:first-child {
    border-radius: 8px 0 0 8px;
  }
  &:last-child {
    border-radius: 0 8px 8px 0;
  }
`;

export const Td = styled.td<{ $align?: 'left' | 'center' | 'right' }>`
  text-align: ${({ $align }) => $align ?? 'left'};
  padding: 20px 12px;
  color: var(--color-text, #121926);
  border-bottom: 1px solid var(--color-border-table, #e4e7ec);
  font-size: 14px;
  font-weight: 500;
  line-height: 100%;
  letter-spacing: -0.02em;
`;

export const Tr = styled.tr<{ $clickable?: boolean }>`
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};

  &:hover td {
    background: var(--color-bg-elevate, #f5f7fb);
  }
  &:last-child td {
    border-bottom: none;
  }
`;
