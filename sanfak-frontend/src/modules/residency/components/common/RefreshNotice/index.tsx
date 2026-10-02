import styled from 'styled-components';
import { Btn } from '../FormElements';
import type { NoticeState } from '../../../lib/query-state';
import { formatUzClock } from '../../../lib/uz-day';

interface Props {
  state: NoticeState;
  updatedAt: number;
  onRetry: () => void;
}

export default function RefreshNotice({ state, updatedAt, onRetry }: Props) {
  if (state !== 'error' && state !== 'forbidden') return null;
  const why = state === 'forbidden' ? ' (ruxsat yo‘q)' : '';
  return (
    <Box role="status">
      Yangilab bo‘lmadi{why} — ko‘rsatilgan holat {formatUzClock(updatedAt)} dagi.
      <Btn $size="sm" $variant="outline" onClick={onRetry}>
        Qayta urinish
      </Btn>
    </Box>
  );
}

const Box = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.danger};
`;
