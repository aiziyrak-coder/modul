import styled from 'styled-components';

export const InfoWrapper = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }

  .left-section {
    display: flex;
    flex-direction: column;
    gap: 20px;

    .plan-info {
      background: #fff;
      border-radius: var(--radius-xl, 16px);
      box-sizing: border-box;
      padding: 20px;

      h3 {
        font-weight: 600;
        font-size: 18px;
        line-height: 100%;
        letter-spacing: -0.02em;
        color: var(--color-text, #121926);
        margin-top: 0;
        margin-bottom: 32px;
      }
    }

    .plan-file {
      background: #fff;
      border-radius: var(--radius-xl, 16px);
      box-sizing: border-box;
      padding: 20px;
    }
  }

  .right-section {
    height: auto;

    h2 {
      font-weight: 600;
      font-size: 20px;
      line-height: 100%;
      letter-spacing: -0.02em;
      color: var(--color-text, #121926);
      margin-top: 0;
      margin-bottom: 12px;
    }

    .comment-block {
      height: calc(100% - 32px);
      background: #fff;
      border-radius: var(--radius-xl, 16px);
      padding: 20px;
      box-sizing: border-box;
      white-space: pre-line;
      font-weight: 500;
      font-size: 14px;
      line-height: 170%;
      letter-spacing: -0.02em;
      color: var(--color-text, #121926);
    }
  }
`;

export const InfoData = styled.div`
  p {
    margin: 0;
    font-weight: 500;
    font-size: 14px;
    line-height: 100%;
    letter-spacing: -0.02em;
    color: var(--color-text-soft, #697586);
  }

  h2 {
    font-weight: 500;
    font-size: 16px;
    line-height: 100%;
    letter-spacing: -0.02em;
    margin: 10px 0 0;
    color: var(--color-text, #121926);
  }
`;

export const FileRowLabel = styled.div`
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-soft, #697586);
  margin-bottom: 6px;
`;

export const FileOpenBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--color-bg-layout, #f5f7fb);
  border: 1px solid var(--color-border, #e3e8ef);
  border-radius: var(--radius-md, 8px);
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text, #121926);
  cursor: pointer;
  width: 100%;
  text-align: left;
  transition: background 0.2s;

  &:hover {
    background: var(--color-border, #e3e8ef);
  }

  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;
