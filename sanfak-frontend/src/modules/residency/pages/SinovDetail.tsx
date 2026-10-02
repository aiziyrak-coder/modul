import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { MdArrowBack, MdAttachFile, MdInfo } from '../icons';
import { App } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import {
  PageTitle,
  SectionTitle,
  Btn,
  StatCards,
} from '../components/common/FormElements';
import { NumberField } from '../components/common/NumberField';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import StatCard from '../components/common/StatCard';
import { formatFileSize } from '../api/curriculum-types';
import { useResidencyCapabilities } from '../lib/capabilities';
import {
  useTrialTest,
  useTrialTestResults,
  useSaveTrialTestResults,
} from '../api/trial-test-api';
import { trialScoreVariant } from '../api/trial-test-types';

const fmtDate = (d: string | null): string => (d ? d.slice(0, 10) : '—');

const Banner = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 20px;
`;
const BannerTitle = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  margin-bottom: 12px;
`;
const BannerMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
`;
const MetaItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;
const MetaLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;
const MetaValue = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;
const FileLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
`;
const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;
const DirtyNote = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const parseScore = (raw: string): number | null => {
  const s = raw.trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const toInputValue = (raw: string): number | null => {
  const v = parseScore(raw);
  return v === null || Number.isNaN(v) ? null : v;
};

export default function SinovDetail() {
  const { message } = App.useApp();

  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOffice, isMentor } = useResidencyCapabilities();
  const canGrade = isOffice || isMentor;

  const { data: detail } = useTrialTest(id);
  const { data: page, isLoading } = useTrialTestResults(id);
  const saveM = useSaveTrialTestResults();

  const test = detail?.test;
  const rows = useMemo(() => page?.results ?? [], [page]);
  const maxScore = page?.maxScore ?? test?.maxScore ?? 100;

  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const r of rows) {
      next[r.residentId] = r.score === null ? '' : String(r.score);
    }
    setDraft(next);
  }, [rows]);

  const avg = page?.summary.avgScore;
  const avgLabel = typeof avg === 'number' ? avg : '—';

  const invalidIds = useMemo(() => {
    const bad = new Set<string>();
    for (const r of rows) {
      const v = parseScore(draft[r.residentId] ?? '');
      if (v === null) continue;
      if (Number.isNaN(v) || v < 0 || v > maxScore) bad.add(r.residentId);
    }
    return bad;
  }, [draft, rows, maxScore]);

  const changed = useMemo(
    () =>
      rows.filter((r) => {
        const v = parseScore(draft[r.residentId] ?? '');
        if (Number.isNaN(v)) return false;
        return v !== r.score;
      }),
    [draft, rows],
  );

  const save = async () => {
    if (!id) return;
    if (invalidIds.size > 0) {
      message.warning(`Ball 0 va ${maxScore} orasida bo‘lishi kerak`);
      return;
    }
    if (changed.length === 0) {
      message.info('O‘zgarish yo‘q');
      return;
    }
    try {
      const res = await saveM.mutateAsync({
        id,
        results: changed.map((r) => ({
          resident: r.residentId,
          score: parseScore(draft[r.residentId] ?? ''),
        })),
      });
      message.success(`${res.updated} ta natija saqlandi`);
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Saqlashda xatolik'));
    }
  };

  return (
    <div>
      <Btn $variant="ghost" $size="sm" onClick={() => navigate('/residency/sinovlar')}>
        <MdArrowBack /> Sinov testlari
      </Btn>

      <PageTitle>{test?.title ?? 'Sinov'}</PageTitle>

      <Banner>
        <BannerTitle>{test?.scienceTitle || 'Fan ko‘rsatilmagan'}</BannerTitle>
        <BannerMeta>
          <MetaItem>
            <MetaLabel>Sana</MetaLabel>
            <MetaValue>{fmtDate(test?.date ?? null)}</MetaValue>
          </MetaItem>
          <MetaItem>
            <MetaLabel>Mutaxassislik</MetaLabel>
            <MetaValue>{test?.specialtyTitle || 'Barchasi'}</MetaValue>
          </MetaItem>
          <MetaItem>
            <MetaLabel>Kurs</MetaLabel>
            <MetaValue>{test?.courseNumber ? `${test.courseNumber}-kurs` : 'Barchasi'}</MetaValue>
          </MetaItem>
          <MetaItem>
            <MetaLabel>Guruh</MetaLabel>
            <MetaValue>{test?.groupTitle || 'Barchasi'}</MetaValue>
          </MetaItem>
          <MetaItem>
            <MetaLabel>Maksimal ball</MetaLabel>
            <MetaValue>{maxScore}</MetaValue>
          </MetaItem>
          <MetaItem>
            <MetaLabel>Savollar</MetaLabel>
            <MetaValue>{test?.questionCount ?? '—'}</MetaValue>
          </MetaItem>
          {test && (
            <MetaItem>
              <MetaLabel>Test fayli</MetaLabel>
              <FileLink href={test.fileUrl} target="_blank" rel="noreferrer">
                <MdAttachFile />
                {test.fileName || test.format || 'Yuklab olish'}
                {test.fileSize === null ? '' : ` · ${formatFileSize(test.fileSize)}`}
              </FileLink>
            </MetaItem>
          )}
        </BannerMeta>
      </Banner>

      <StatCards>
        <StatCard icon="👥" iconBg="#EBF5FB" number={page?.summary.total ?? 0} label="Talabalar" />
        <StatCard
          icon="📝"
          iconBg="#FEF9E7"
          number={page?.summary.scored ?? 0}
          label="Baholangan"
        />
        <StatCard
          icon="⏳"
          iconBg="#FDEDEC"
          number={page?.summary.notScored ?? 0}
          label="Baholanmagan"
        />
        <StatCard icon="📊" iconBg="#EAFAF1" number={avgLabel} label="O‘rtacha ball" />
      </StatCards>

      <SectionTitle>Natijalar</SectionTitle>

      {canGrade && (
        <Toolbar>
          <Btn
            $variant="primary"
            onClick={save}
            disabled={saveM.isPending || changed.length === 0 || invalidIds.size > 0}
          >
            Natijalarni saqlash
          </Btn>
          <DirtyNote>
            {invalidIds.size > 0
              ? `${invalidIds.size} ta qatorda ball 0–${maxScore} oralig‘idan tashqarida`
              : changed.length > 0
                ? `${changed.length} ta o‘zgarish saqlanmagan`
                : 'O‘zgarish yo‘q'}
          </DirtyNote>
        </Toolbar>
      )}

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>№</Th>
              <Th>F.I.Sh</Th>
              <Th>Mutaxassislik</Th>
              <Th style={{ width: 90 }}>Kurs</Th>
              <Th style={{ width: 120 }}>Guruh</Th>
              <Th style={{ width: 130 }}>Ball</Th>
              <Th style={{ width: 110 }}>Holat</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <Tr key={r.residentId}>
                <Td>{i + 1}</Td>
                <Td style={{ fontWeight: 500 }}>{r.fullName || '—'}</Td>
                <Td>{r.specialtyTitle || '—'}</Td>
                <Td>{r.courseNumber ? `${r.courseNumber}-kurs` : '—'}</Td>
                <Td>{r.groupTitle || '—'}</Td>
                <Td>
                  {canGrade ? (
                    <NumberField
                      status={invalidIds.has(r.residentId) ? 'error' : undefined}
                      style={{ width: '100%' }}
                      value={toInputValue(draft[r.residentId] ?? '')}
                      placeholder="—"
                      onChange={(v) =>
                        setDraft((d) => ({ ...d, [r.residentId]: v === null ? '' : String(v) }))
                      }
                    />
                  ) : (
                    <Badge variant={trialScoreVariant(r.score, maxScore)}>
                      {r.score === null ? '—' : r.score}
                    </Badge>
                  )}
                </Td>
                <Td>
                  <Badge variant={r.score === null ? 'umumiy' : 'success'}>
                    {r.score === null ? 'Baholanmagan' : 'Baholangan'}
                  </Badge>
                </Td>
              </Tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <Tr>
                <Td colSpan={7} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                  <MdInfo /> Bu sinov kesimiga mos talaba topilmadi
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  );
}
