import styled from 'styled-components';

interface Props {
  rate: number;
  height?: number;
  vertical?: boolean;
}

const Track = styled.div<{ $h: number; $vertical: boolean }>`
  width: ${({ $vertical }) => ($vertical ? `${8}px` : '100%')};
  height: ${({ $vertical, $h }) => ($vertical ? '100%' : `${$h}px`)};
  background: var(--color-border-soft, #eef2f6);
  border-radius: var(--radius-pill, 9999px);
  overflow: hidden;
  position: relative;
`;

const Fill = styled.div<{ $rate: number; $vertical: boolean }>`
  position: absolute;
  border-radius: var(--radius-pill, 9999px);
  background: var(--brand-primary, #37cb94);
  transition: all 0.4s ease;

  ${({ $vertical, $rate }) =>
    $vertical
      ? `width: 100%; height: ${$rate}%; bottom: 0;`
      : `height: 100%; width: ${$rate}%; left: 0; top: 0;`}
`;

const Label = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-soft, #697586);
  white-space: nowrap;
`;

export function ProgressIndicator({ rate, height = 8, vertical = false }: Props) {
  const pct = Math.max(0, Math.min(100, rate));
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexDirection: vertical ? 'column' : 'row',
        width: vertical ? 'fit-content' : '100%',
      }}
    >
      <Track $h={height} $vertical={vertical}>
        <Fill $rate={pct} $vertical={vertical} />
      </Track>
      <Label>{pct}%</Label>
    </div>
  );
}
