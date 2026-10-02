import styled from 'styled-components';

export const FileRow = styled.div<{ $empty?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  min-width: 0;
  background: var(--color-bg-elevate);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: ${(p) => (p.$empty ? 'default' : 'pointer')};
  opacity: ${(p) => (p.$empty ? 0.55 : 1)};
  transition:
    background 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: ${(p) =>
      p.$empty ? 'var(--color-bg-elevate)' : 'color-mix(in srgb, var(--brand-primary) 8%, #fff)'};
    border-color: ${(p) =>
      p.$empty ? 'var(--color-border)' : 'color-mix(in srgb, var(--brand-primary) 30%, #fff)'};
  }
`;

export const FileName = styled.span`
  font-size: 13px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
