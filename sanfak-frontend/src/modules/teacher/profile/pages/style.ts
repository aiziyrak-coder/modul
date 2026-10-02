import styled from 'styled-components';

export const HeaderSection = styled.div`
  position: relative;
  margin-bottom: var(--space-4);

  background: var(--color-bg);
  border-radius: var(--radius-xl);
  padding: var(--space-2) var(--space-2) var(--space-4);

  .banner {
    height: 140px;
    border-radius: var(--radius-xl);
    background: linear-gradient(90deg, var(--brand-warning) 0%, var(--brand-primary) 100%);
    opacity: 0.55;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
    padding: var(--space-5) var(--space-4) var(--space-1);

    @media screen and (max-width: 640px) {
      align-items: flex-start;
      padding: 0 var(--space-4);
      margin-top: -40px;
    }
  }

  .avatar-wrap {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    border: 4px solid var(--color-bg);
    overflow: hidden;
    flex-shrink: 0;
    background: var(--color-bg-elevate);
    align-self: flex-end;
    margin-top: -72px;

    @media screen and (max-width: 640px) {
      width: 80px;
      height: 80px;
      align-self: auto;
      margin-top: 0;
    }
  }

  .info {
    min-width: 0;
  }

  .name-line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--color-text);
    }

    .verified {
      color: var(--brand-primary);
      font-size: 18px;
    }
  }

  .position {
    margin: var(--space-1) 0 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-soft);
  }

  .action {
    margin-left: auto;

    @media screen and (max-width: 640px) {
      margin-left: 0;
    }
  }
`;

export const Card = styled.div`
  background: var(--color-bg);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  height: 100%;

  h3 {
    margin: 0 0 var(--space-4);
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text);
  }
`;

export const Label = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-soft);
  margin-bottom: var(--space-1);
`;

export const DefaultValue = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  min-height: 22px;
  word-break: break-word;

  a {
    color: var(--ant-color-primary, var(--brand-primary));
  }
`;

export const FieldDivider = styled.div`
  height: 1px;
  background: var(--color-border);
  margin: var(--space-4) 0;
`;

export const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-3);
`;

export const LinkRow = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
  word-break: break-all;

  a {
    color: var(--ant-color-primary, var(--brand-primary));
  }
`;
