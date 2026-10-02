import styled from 'styled-components';
import { Btn } from '../FormElements';
import type { NoticeState } from '../../../lib/query-state';

interface Props {
  state: Exclude<NoticeState, 'ok'>;
  onRetry: () => void;
  compact?: boolean;
}

export default function QueryNotice({ state, onRetry, compact }: Props) {
  if (state === 'loading') {
    return <Notice $compact={compact}>Yuklanmoqda…</Notice>;
  }
  if (state === 'forbidden') {
    return (
      <Notice $compact={compact} $error>
        Bu ma'lumotni ko'rish huquqingiz yo'q.
      </Notice>
    );
  }
  return (
    <Notice $compact={compact} $error>
      Ma'lumotni yuklab bo'lmadi.
      <RetryRow $compact={compact}>
        <Btn $size="sm" $variant="outline" onClick={onRetry}>
          Qayta urinish
        </Btn>
      </RetryRow>
    </Notice>
  );
}

const Notice = styled.div<{ $error?: boolean; $compact?: boolean }>`
  padding: ${({ $compact }) => ($compact ? '4px 0' : '28px')};
  text-align: ${({ $compact }) => ($compact ? 'left' : 'center')};
  font-size: 13px;
  border-radius: ${({ $compact, theme }) => ($compact ? '0' : theme.radius.lg)};
  border: ${({ $compact, theme }) => ($compact ? 'none' : `1px solid ${theme.colors.border}`)};
  background: ${({ $compact, theme }) => ($compact ? 'transparent' : theme.colors.white)};
  color: ${({ theme, $error }) => ($error ? theme.colors.danger : theme.colors.textMuted)};
  margin-bottom: ${({ $compact }) => ($compact ? '0' : '24px')};
`;

const RetryRow = styled.div<{ $compact?: boolean }>`
  margin-top: 10px;
  display: flex;
  justify-content: ${({ $compact }) => ($compact ? 'flex-start' : 'center')};
`;
