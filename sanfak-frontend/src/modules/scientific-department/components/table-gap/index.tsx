import type { ReactNode } from 'react';

export default function TableGap({ children }: { children: ReactNode }) {
  return (
    <div
      className="sci-table-gap"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
    >
      <style>{`
        .sci-table-gap > div > div:first-child {
          display: flex;
          flex-direction: column;
          margin-bottom: var(--space-6, 24px);
        }
        .sci-table-gap .ant-spin-nested-loading {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .sci-table-gap .ant-spin-container {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .sci-table-gap .ant-spin-nested-loading .ant-spin { max-height: none; }
        .sci-table-gap .ant-spin-container > div:not(:has(> .ant-flex)) {
          flex-shrink: 0;
          overflow: auto;
        }
        .sci-table-gap th,
        .sci-table-gap td {
          white-space: nowrap;
        }
        .sci-table-gap .ant-spin-container > div:has(> .ant-flex) {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .sci-table-gap .ant-spin-container > div > .ant-flex {
          flex: 1;
          align-items: center;
        }
      `}</style>
      {children}
    </div>
  );
}
