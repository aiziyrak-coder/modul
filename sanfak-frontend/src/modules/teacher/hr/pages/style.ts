import styled from 'styled-components';

export const LeftCard = styled.div`
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  margin-bottom: var(--space-4);
`;

export const RightCard = styled.div`
  background: var(--color-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-5);

  h3 {
    margin: 0 0 var(--space-4);
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }
`;

export const Avatar = styled.div<{ $src?: string | null }>`
  width: 130px;
  height: 130px;
  border-radius: var(--radius-lg);
  background: ${({ $src }) =>
    $src ? `url(${$src}) center/cover no-repeat` : 'var(--color-bg-elevate)'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-soft);
  font-size: 40px;
  font-weight: 600;
  margin-bottom: var(--space-5);
`;

export const Divider = styled.div`
  height: 1px;
  background: var(--color-border);
  margin: var(--space-5) 0;
`;

export const SectionTitle = styled.div`
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-3);
`;

export const FieldWrap = styled.div<{ $changed?: boolean }>`
  padding: ${({ $changed }) => ($changed ? 'var(--space-2) var(--space-3)' : '0')};
  border-radius: var(--radius-md);
  border: 1px solid ${({ $changed }) => ($changed ? 'var(--brand-warning)' : 'transparent')};
  background: ${({ $changed }) => ($changed ? 'rgba(240, 192, 0, 0.08)' : 'transparent')};
`;

export const FieldHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
`;

export const FieldLabel = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-soft);
`;

export const FieldValue = styled.div<{ $changed?: boolean }>`
  font-size: 14px;
  font-weight: 500;
  color: ${({ $changed }) => ($changed ? 'var(--brand-warning)' : 'var(--color-text)')};
  word-break: break-word;

  a {
    color: inherit;
  }
`;

export const ChangedPill = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--brand-warning) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--brand-warning) 45%, transparent);
  color: color-mix(in srgb, var(--brand-warning) 55%, #000);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
`;

export const LinkRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
  font-size: 13px;

  a {
    color: var(--ant-color-primary, var(--brand-primary));
    word-break: break-all;
  }
`;

export const TabSubTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-soft);
  margin: var(--space-3) 0 var(--space-2);
`;

export const DocRow = styled.a<{ $changed?: boolean }>`
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-2);
  background: ${({ $changed }) => ($changed ? 'rgba(240, 192, 0, 0.08)' : 'var(--color-bg-elevate)')};
  border: 1px solid ${({ $changed }) => ($changed ? 'var(--brand-warning)' : 'transparent')};
  text-decoration: none;
  cursor: pointer;

  .icon {
    color: ${({ $changed }) => ($changed ? 'var(--brand-warning)' : 'var(--color-text-soft)')};
    font-size: 16px;
    flex-shrink: 0;
  }

  .name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text);
    word-break: break-word;
  }
`;

export const EmptyDocs = styled.div`
  padding: var(--space-4);
  text-align: center;
  color: var(--color-text-soft);
  font-size: 13px;
`;

export const ActionBar = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) 0;
  margin-top: var(--space-2);

  .ant-btn {
    min-width: 140px;
  }
`;
