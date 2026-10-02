import { useTranslation } from '@/shared/lib/i18n';
import type { SeminarResult } from '../../model/types';
import * as S from './style';

const RESULT_COLORS: Record<SeminarResult | 'none', { color: string; bg: string; key: string }> = {
  defended: { color: '#16a34a', bg: '#f0fdf4', key: 'scienceCouncil.defense.defended' },
  not_defended: { color: '#dc2626', bg: '#fef2f2', key: 'scienceCouncil.defense.notDefended' },
  none: { color: '#6b7280', bg: '#f9fafb', key: 'scienceCouncil.defense.notSet' },
};

export function DefenseResultTag({ result }: { result?: SeminarResult | null }) {
  const { t } = useTranslation();
  const cfg = RESULT_COLORS[result ?? 'none'];

  return (
    <S.Badge $color={cfg.color} $bg={cfg.bg}>
      {t(cfg.key)}
    </S.Badge>
  );
}
