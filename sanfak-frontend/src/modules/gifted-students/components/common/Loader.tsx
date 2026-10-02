import styled, { keyframes } from 'styled-components';

const spin = keyframes`to { transform: rotate(360deg); }`;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 16px;
`;

const Spinner = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 3px solid var(--brand-primary-soft);
  border-top-color: var(--brand-primary);
  animation: ${spin} 0.8s linear infinite;
`;

const Text = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

export default function Loader({ text = 'Yuklanmoqda...' }: { text?: string }) {
  return (
    <Wrap>
      <Spinner />
      <Text>{text}</Text>
    </Wrap>
  );
}
