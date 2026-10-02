import { Typography } from 'antd';
import type { ElectiveAlternative } from '../../model/types';

const { Text } = Typography;

interface IProps {
  title: string | null;
  alternatives: ElectiveAlternative[];
}

export const ALT_LINE = {
  marker: '• ',
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--color-text-soft)',
} as const;

export function visibleAlternatives(list: ElectiveAlternative[] | undefined) {
  return (list ?? []).filter((a) => a && (a.code || a.title));
}

const ScienceTitleCell = ({ title, alternatives }: IProps) => {
  const visible = visibleAlternatives(alternatives);

  return (
    <>
      <Text style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
        {title ?? '—'}
      </Text>

      {visible.length > 0 ? (
        <div
          style={{
            marginTop: 'var(--space-1)',
            paddingTop: 'var(--space-1)',
            paddingInlineStart: 'var(--space-2)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          {visible.map((alt, i) => (
            <div key={alt.scienceId ?? `${alt.code ?? ''}-${i}`} style={{ lineHeight: ALT_LINE.lineHeight }}>
              <Text
                style={{
                  fontSize: ALT_LINE.fontSize,
                  fontWeight: 400,
                  color: ALT_LINE.color,
                }}
              >
                {`${ALT_LINE.marker}${alt.title ?? '—'}`}
              </Text>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
};

export default ScienceTitleCell;
