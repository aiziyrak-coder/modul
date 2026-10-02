import { useRef, useState } from 'react';
import styled from 'styled-components';

const TruncText = styled.div<{ $blue?: boolean }>`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: ${({ $blue }) => ($blue ? '#1565C0' : '#475569')};
  max-width: 220px;
  cursor: default;
`;

const TooltipFixed = styled.div`
  position: fixed;
  z-index: 9999;
  background: #1e293b;
  color: #f8fafc;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 12px;
  width: 300px;
  white-space: normal;
  line-height: 1.6;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  pointer-events: none;
`;

interface Pos {
  left: number;
  top: number;
  above: boolean;
}

export default function TruncCell({ text, blue }: { text: string; blue?: boolean }) {
  const [pos, setPos] = useState<Pos | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const show = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const above = window.innerHeight - r.bottom < 140;
    setPos({ left: r.left, top: above ? r.top - 4 : r.bottom + 4, above });
  };

  if (!text) return <span style={{ color: '#CBD5E1', fontSize: 13 }}>—</span>;
  return (
    <div
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      style={{ display: 'inline-block', maxWidth: 220 }}
    >
      <TruncText $blue={blue}>{text}</TruncText>
      {pos && (
        <TooltipFixed
          style={{
            left: pos.left,
            ...(pos.above ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
          }}
        >
          {text}
        </TooltipFixed>
      )}
    </div>
  );
}
