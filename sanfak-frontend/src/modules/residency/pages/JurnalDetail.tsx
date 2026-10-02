import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { MdArrowBack, MdFileDownload } from '../icons';
import { PageTitle, StatCards } from '../components/common/FormElements';
import QueryNotice from '../components/common/QueryNotice';
import { combineState } from '../lib/query-state';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import StatCard from '../components/common/StatCard';
import { ExcuseAbsenceButton } from '../components/AttendanceExcuse';
import { useResidencyCapabilities } from '../lib/capabilities';
import { lessonScoreAverage, scoreAvgText } from '../lib/lesson-score';
import { useResidentAttendance, useAttendanceStats } from '../api/residency-api';
import type { Attendance, AttendanceStatus, LessonType } from '../api/types';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Keldi',
  absent: 'Kelmadi',
  excused: 'Sababli',
};
const STATUS_VARIANT: Record<AttendanceStatus, string> = {
  present: 'success',
  absent: 'danger',
  excused: 'warning',
};
const LESSON_LABEL: Record<LessonType, string> = {
  maruza: "Ma'ruza",
  amaliy: 'Amaliy',
  test: 'Test',
  oraliq_nazorat: 'Oraliq nazorat',
  yakuniy_nazorat: 'Yakuniy nazorat',
};
const day = (d: string | null): string => (d ? d.slice(0, 10) : '—');
const lessonLabel = (l: LessonType | null): string => (l ? LESSON_LABEL[l] : '—');

function AsosCell({ d }: { d: Attendance }) {
  if (d.status === 'excused' && d.application?.fileUrl) {
    return (
      <a
        href={d.application.fileUrl}
        target="_blank"
        rel="noreferrer"
        title={d.application.reason ?? 'Ariza hujjati'}
        style={{ color: '#1565C0', display: 'inline-flex', alignItems: 'center', gap: 4 }}
      >
        <MdFileDownload size={15} />
      </a>
    );
  }
  if (d.status === 'excused' && !d.application && !d.fromDate && d.excuseReason) {
    return (
      <span title={d.excuseReason} style={{ fontSize: 12, color: '#B9770E', cursor: 'help' }}>
        Bo‘lim
      </span>
    );
  }
  return <span style={{ color: '#CBD5E1' }}>—</span>;
}

export default function JurnalDetail() {
  const { residentId } = useParams<{ residentId: string }>();
  const navigate = useNavigate();
  const { canExcuseAttendance } = useResidencyCapabilities();

  const attendanceQ = useResidentAttendance(residentId);
  const statsQ = useAttendanceStats(residentId);
  const records = useMemo(() => attendanceQ.data ?? [], [attendanceQ.data]);
  const stats = statsQ.data;
  const queryState = combineState([attendanceQ, statsQ]);

  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);
  const brief = records[0]?.resident ?? null;
  const fullName = brief?.fullName || stats?.summary?.fullName || '—';

  const keldi = records.filter((r) => r.status === 'present').length;
  const kelmadi = records.filter((r) => r.status === 'absent').length;
  const sababli = records.filter((r) => r.status === 'excused').length;
  const ortachaBall = lessonScoreAverage(records);

  return (
    <div>
      <BackBtn onClick={() => navigate(-1)}>
        <MdArrowBack size={16} /> Orqaga
      </BackBtn>

      <PageTitle style={{ marginBottom: 14 }}>{fullName} — darslar tarixi</PageTitle>

      {queryState !== 'ok' && (
        <QueryNotice state={queryState} onRetry={() => { void attendanceQ.refetch(); void statsQ.refetch(); }} />
      )}

      {brief && (
        <MetaBlock>
          <MetaItem>
            <MetaLabel>Mutaxassislik</MetaLabel>
            <MetaValue>{brief.specialtyTitle || '—'}</MetaValue>
          </MetaItem>
          <Divider />
          <MetaItem>
            <MetaLabel>Kafedra</MetaLabel>
            <MetaValue>{brief.departmentTitle || '—'}</MetaValue>
          </MetaItem>
          <Divider />
          <MetaItem>
            <MetaLabel>Kurs</MetaLabel>
            <MetaValue>{brief.courseNumber != null ? `${brief.courseNumber}-kurs` : '—'}</MetaValue>
          </MetaItem>
          <Divider />
          <MetaItem>
            <MetaLabel>Guruh</MetaLabel>
            <MetaValue>{brief.groupTitle || '—'}</MetaValue>
          </MetaItem>
        </MetaBlock>
      )}

      <StatCards style={{ marginBottom: 20 }}>
        <StatCard icon="📚" iconBg="#EBF5FB" number={records.length} label="Jami darslar" />
        <StatCard
          icon="⭐"
          iconBg="#EAFAF1"
          number={scoreAvgText(ortachaBall)}
          label="O‘rtacha ball"
        />
        <StatCard icon="✅" iconBg="#EAFAF1" number={keldi} label="Keldi" />
        <StatCard icon="❌" iconBg="#FDEDEC" number={kelmadi} label="Kelmadi" />
        <StatCard icon="🕐" iconBg="#FEF9E7" number={sababli} label="Sababli" />
      </StatCards>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>№</Th>
              <Th style={{ width: 120 }}>Sana</Th>
              <Th>Fan</Th>
              <Th>Dars turi</Th>
              <Th>Holat</Th>
              <Th style={{ width: 80 }}>Ball</Th>
              <Th style={{ width: 80 }}>Asos</Th>
              {canExcuseAttendance && <Th style={{ width: 90 }}>Amallar</Th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => (
              <Tr key={d.id}>
                <Td>{i + 1}</Td>
                <Td style={{ whiteSpace: 'nowrap' }}>{day(d.date)}</Td>
                <Td>{d.scienceTitle ?? '—'}</Td>
                <Td>{lessonLabel(d.lessonType)}</Td>
                <Td>
                  <Badge variant={STATUS_VARIANT[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                </Td>
                <Td>
                  {d.status === 'present' && d.score != null ? (
                    d.score
                  ) : (
                    <span style={{ color: '#94A3B8' }}>—</span>
                  )}
                </Td>
                <Td>
                  <AsosCell d={d} />
                </Td>
                {canExcuseAttendance && (
                  <Td>
                    <ExcuseAbsenceButton record={d} />
                  </Td>
                )}
              </Tr>
            ))}
            {sorted.length === 0 && (
              <Tr>
                <Td
                  colSpan={canExcuseAttendance ? 8 : 7}
                  style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}
                >
                  Yozuvlar topilmadi
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>
    </div>
  );
}

const BackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: none;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 18px;
  &:hover {
    background: ${({ theme }) => theme.colors.bg};
    color: ${({ theme }) => theme.colors.text};
  }
`;

const MetaBlock = styled.div`
  display: flex;
  gap: 24px;
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
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
  letter-spacing: 0.4px;
`;

const MetaValue = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const Divider = styled.div`
  width: 1px;
  height: 32px;
  background: ${({ theme }) => theme.colors.border};
`;
