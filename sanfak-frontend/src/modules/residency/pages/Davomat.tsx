import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { useAcademicYears, withCurrent, useCourses } from '../api/reference-api';
import { MdAdd, MdVisibility, MdFileDownload } from '../icons';
import { Select, DatePicker } from '@/shared/ui';
import { PageTitle, FilterBar, Btn, Tabs, Tab, StatCards } from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import Pager from '../components/common/Pager';
import StatCard from '../components/common/StatCard';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import AnnounceModal from '../components/LessonSession/AnnounceModal';
import SessionList from '../components/LessonSession/SessionList';
import { ExcuseAbsenceButton } from '../components/AttendanceExcuse';
import { useResidencyCapabilities } from '../lib/capabilities';
import {
  parseJournalTab,
  sessionDetailPath,
  withJournalTab,
  type JournalTab,
} from '../lib/journal-tab';
import { LESSON_LABEL, LESSON_TYPES, lessonLabel } from '../lib/lesson-type';
import { scoreAvgText } from '../lib/lesson-score';
import {
  useAttendance,
  useJournalStats,
  useAttendanceByResident,
  useResidentAttendance,
  useMyResident,
  useSciences,
  useGroups,
} from '../api/residency-api';
import type { Attendance, AttendanceStatus } from '../api/types';

const lateText = (minutes: number | null) =>
  minutes != null ? `Kechikdi · ${minutes} daq` : 'Kechikdi';

const PAGE_SIZE = 10;

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
const day = (d: string | null): string => (d ? d.slice(0, 10) : '—');

const ballText = (a: Attendance): string =>
  a.status === 'present' && a.score != null ? String(a.score) : '—';

const clockRange = (a: Attendance): string =>
  a.checkInTime && a.checkOutTime ? `${a.checkInTime}–${a.checkOutTime}` : '—';

interface Counts {
  keldi: number;
  kelmadi: number;
  sababli: number;
  kechikdi: number;
  total: number;
  pct: number;
}
function computeCounts(records: Attendance[]): Counts {
  const keldi = records.filter((r) => r.status === 'present').length;
  const kelmadi = records.filter((r) => r.status === 'absent').length;
  const sababli = records.filter((r) => r.status === 'excused').length;
  const kechikdi = records.filter((r) => r.late).length;
  const total = records.length;
  return {
    keldi,
    kelmadi,
    sababli,
    kechikdi,
    total,
    pct: total ? Math.round((keldi / total) * 100) : 0,
  };
}

export default function Davomat() {
  const { isStudent, canAnnounceSession } = useResidencyCapabilities();

  return (
    <div>
      <PageTitle>Jurnal (Davomat)</PageTitle>
      {isStudent ? <StudentJournal /> : <StaffJournal canAnnounce={canAnnounceSession} />}
    </div>
  );
}

function StudentJournal() {
  const { data: myResident } = useMyResident();
  const residentId = myResident?.id;
  const { data: records = [] } = useResidentAttendance(residentId);

  const [tab, setTab] = useState<'kunlik' | 'tarix'>('kunlik');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<Attendance | null>(null);

  const c = computeCounts(records);
  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date)), [records]);
  const latestDay = sorted[0] ? day(sorted[0].date) : '';
  const effDate = date || latestDay;
  const kunlik = useMemo(() => sorted.filter((r) => day(r.date) === effDate), [sorted, effDate]);

  const rows = tab === 'kunlik' ? kunlik : sorted;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const switchTab = (t: 'kunlik' | 'tarix') => {
    setTab(t);
    setPage(1);
  };

  return (
    <>
      <StatCards>
        <StatCard icon="📊" iconBg="#EBF5FB" number={`${c.pct}%`} label="Umumiy davomat" />
        <StatCard icon="✅" iconBg="#EAFAF1" number={c.keldi} label="Keldi" />
        <StatCard icon="❌" iconBg="#FDEDEC" number={c.kelmadi} label="Kelmadi" />
        <StatCard icon="🕐" iconBg="#FEF9E7" number={c.sababli} label="Sababli" />
        <StatCard icon="⏱️" iconBg="#FDF2E9" number={c.kechikdi} label="Kechikdi" />
      </StatCards>

      <Tabs>
        <Tab $active={tab === 'kunlik'} onClick={() => switchTab('kunlik')}>
          Kunlik dars
        </Tab>
        <Tab $active={tab === 'tarix'} onClick={() => switchTab('tarix')}>
          Darslar tarixi
        </Tab>
      </Tabs>

      {tab === 'kunlik' && (
        <FilterBar>
          <DatePicker
            value={effDate || null}
            style={{ width: '100%', minWidth: 200 }}
            onChange={(v) => {
              setDate(v ?? '');
              setPage(1);
            }}
          />
        </FilterBar>
      )}

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>№</Th>
              <Th style={{ width: 110 }}>Sana</Th>
              <Th>Fan</Th>
              <Th>Dars turi</Th>
              <Th>Davomat</Th>
              <Th style={{ width: 90 }}>Ball</Th>
              <Th style={{ width: 90 }}>Amallar</Th>
            </tr>
          </thead>
          <tbody>
            {paged.map((a, i) => (
              <Tr key={a.id}>
                <Td>{(page - 1) * PAGE_SIZE + i + 1}</Td>
                <Td>{day(a.date)}</Td>
                <Td>{a.scienceTitle ?? '—'}</Td>
                <Td>{lessonLabel(a.lessonType)}</Td>
                <Td>
                  <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  {a.late && <LateChip>{lateText(a.lateMinutes)}</LateChip>}
                </Td>
                <Td>{ballText(a)}</Td>
                <Td>
                  <Btn $variant="ghost" $size="sm" onClick={() => setViewing(a)} title="Batafsil">
                    <MdVisibility />
                  </Btn>
                </Td>
              </Tr>
            ))}
            {paged.length === 0 && (
              <Tr>
                <Td colSpan={7} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                  Ma'lumot topilmadi
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Pager page={page} totalPages={totalPages} onPage={setPage} />

      <DetailModal record={viewing} onClose={() => setViewing(null)} />
    </>
  );
}

function StaffJournal({ canAnnounce }: { canAnnounce: boolean }) {
  const { data: courses = [] } = useCourses();

  const { data: academicYears = [] } = useAcademicYears();

  const navigate = useNavigate();
  const { data: sciences = [] } = useSciences();
  const { data: groups = [] } = useGroups();

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseJournalTab(searchParams.get('tab'), canAnnounce);
  const setTab = (t: JournalTab) => setSearchParams((p) => withJournalTab(p, t), { replace: true });
  const showAttendance = tab !== 'mashgulotlar';
  const [announcing, setAnnouncing] = useState(false);
  const [academicYear, setAcademicYear] = useState('');
  const [science, setScience] = useState('');
  const [course, setCourse] = useState('');
  const [group, setGroup] = useState('');
  const [lessonType, setLessonType] = useState('');
  const [date, setDate] = useState('');
  const [kunlikPage, setKunlikPage] = useState(1);
  const [tarixPage, setTarixPage] = useState(1);
  const [viewing, setViewing] = useState<Attendance | null>(null);

  const filters = useMemo(
    () => ({
      academicYear: academicYear || undefined,
      science: science || undefined,
      course: course || undefined,
      group: group || undefined,
      lessonType: lessonType || undefined,
      date: date || undefined,
    }),
    [academicYear, science, course, group, lessonType, date],
  );

  const { data: paged, isFetching: kunlikFetching } = useAttendance(
    { ...filters, page: kunlikPage, limit: PAGE_SIZE },
    { enabled: showAttendance },
  );
  const items = useMemo(() => paged?.items ?? [], [paged]);

  const { data: stats } = useJournalStats(filters, { enabled: showAttendance });
  const c = stats ?? { present: 0, absent: 0, excused: 0, late: 0, total: 0, percent: 0 };

  const { data: rollup, isFetching: tarixFetching } = useAttendanceByResident(
    { ...filters, page: tarixPage, limit: PAGE_SIZE },
    { enabled: showAttendance },
  );

  const kunlikTotalPages = Math.max(1, paged?.totalPages ?? 1);
  const kunlikRows = items;
  const tarixTotalPages = Math.max(1, rollup?.totalPages ?? 1);
  const tarixRows = rollup?.items ?? [];

  const hasFilter = Object.values(filters).some(Boolean);

  const resetPage = () => {
    setKunlikPage(1);
    setTarixPage(1);
  };

  return (
    <>
      {showAttendance && (
        <StatCards>
          <StatCard icon="📊" iconBg="#EBF5FB" number={`${c.percent}%`} label="Umumiy davomat" />
          <StatCard icon="✅" iconBg="#EAFAF1" number={c.present} label="Keldi" />
          <StatCard icon="❌" iconBg="#FDEDEC" number={c.absent} label="Kelmadi" />
          <StatCard icon="🕐" iconBg="#FEF9E7" number={c.excused} label="Sababli" />
          <StatCard icon="⏱️" iconBg="#FDF2E9" number={c.late} label="Kechikdi" />
        </StatCards>
      )}

      <Tabs>
        <Tab $active={tab === 'kunlik'} onClick={() => setTab('kunlik')}>
          Kunlik dars
        </Tab>
        <Tab $active={tab === 'tarix'} onClick={() => setTab('tarix')}>
          Darslar tarixi
        </Tab>
        {canAnnounce && (
          <Tab $active={tab === 'mashgulotlar'} onClick={() => setTab('mashgulotlar')}>
            Mashg‘ulotlar
          </Tab>
        )}
      </Tabs>

      {showAttendance && (
        <FilterBar>
          <Select
            value={academicYear}
            style={{ width: 'auto', minWidth: 150 }}
            onChange={(value) => {
              setAcademicYear(value);
              resetPage();
            }}
            options={[
              { value: '', label: 'O‘quv yili — barchasi' },
              ...withCurrent(academicYears, academicYear).map((y) => ({ value: y.id, label: y.title })),
            ]}
          />
          <Select
            value={science}
            showSearch
            optionFilterProp="label"
            style={{ width: 'auto', minWidth: 150 }}
            onChange={(value) => {
              setScience(value);
              resetPage();
            }}
            options={[
              { value: '', label: 'Barcha fanlar' },
              ...sciences.map((x) => ({ value: x.id, label: x.title })),
            ]}
          />
          <Select
            value={course}
            style={{ width: 'auto', minWidth: 150 }}
            onChange={(value) => {
              setCourse(value);
              resetPage();
            }}
            options={[
              { value: '', label: 'Barcha kurs' },
              ...courses.map((x) => ({ value: String(x.number), label: x.title })),
            ]}
          />
          <Select
            value={group}
            showSearch
            optionFilterProp="label"
            style={{ width: 'auto', minWidth: 150 }}
            onChange={(value) => {
              setGroup(value);
              resetPage();
            }}
            options={[
              { value: '', label: 'Barcha guruh' },
              ...groups.map((g) => ({ value: g.id, label: g.title })),
            ]}
          />
          <Select
            value={lessonType}
            style={{ width: 'auto', minWidth: 150 }}
            onChange={(value) => {
              setLessonType(value);
              resetPage();
            }}
            options={[
              { value: '', label: 'Barcha dars turi' },
              ...LESSON_TYPES.map((l) => ({ value: l as string, label: LESSON_LABEL[l] })),
            ]}
          />
          <DatePicker
            value={date || null}
            style={{ width: '100%', minWidth: 200 }}
            onChange={(v) => {
              setDate(v ?? '');
              resetPage();
            }}
          />
          {canAnnounce && (
            <div style={{ marginLeft: 'auto' }}>
              <Btn $variant="primary" onClick={() => setAnnouncing(true)}>
                <MdAdd /> Mashg‘ulot e’lon qilish
              </Btn>
            </div>
          )}
        </FilterBar>
      )}

      {tab === 'kunlik' ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th style={{ width: 48 }}>№</Th>
                  <Th>F.I.Sh</Th>
                  <Th>Fan</Th>
                  <Th>Mutaxassislik</Th>
                  <Th>Kurs</Th>
                  <Th>Davomat</Th>
                  <Th>Dars turi</Th>
                  <Th style={{ width: 80 }}>Ball</Th>
                  <Th style={{ width: 110 }}>Amallar</Th>
                </tr>
              </thead>
              <tbody>
                {kunlikRows.map((a, i) => (
                  <Tr key={a.id}>
                    <Td>{(kunlikPage - 1) * PAGE_SIZE + i + 1}</Td>
                    <Td>{a.resident?.fullName ?? '—'}</Td>
                    <Td>{a.scienceTitle ?? '—'}</Td>
                    <Td>{a.resident?.specialtyTitle ?? '—'}</Td>
                    <Td>{a.resident?.courseNumber != null ? `${a.resident.courseNumber}-kurs` : '—'}</Td>
                    <Td>
                      <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                      {a.late && <LateChip>{lateText(a.lateMinutes)}</LateChip>}
                    </Td>
                    <Td>{lessonLabel(a.lessonType)}</Td>
                    <Td>{ballText(a)}</Td>
                    <Td>
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <Btn $variant="ghost" $size="sm" onClick={() => setViewing(a)} title="Batafsil">
                          <MdVisibility />
                        </Btn>
                        <ExcuseAbsenceButton record={a} />
                      </span>
                    </Td>
                  </Tr>
                ))}
                {kunlikRows.length === 0 && (
                  <Tr>
                    <Td colSpan={9} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                      {kunlikFetching
                        ? 'Yuklanmoqda…'
                        : hasFilter
                          ? 'Filtrga mos dars topilmadi'
                          : "Ma'lumot topilmadi"}
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
          <Pager page={kunlikPage} totalPages={kunlikTotalPages} onPage={setKunlikPage} />
        </>
      ) : tab === 'tarix' ? (
        <>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th style={{ width: 48 }}>№</Th>
                  <Th>F.I.Sh</Th>
                  <Th>Mutaxassislik</Th>
                  <Th>Kurs</Th>
                  <Th>Jami darslar</Th>
                  <Th>O‘rtacha ball</Th>
                  <Th>So‘nggi sana</Th>
                  <Th style={{ width: 90 }}>Batafsil</Th>
                </tr>
              </thead>
              <tbody>
                {tarixRows.map((g, i) => {
                  return (
                    <Tr key={g.residentId}>
                      <Td>{(tarixPage - 1) * PAGE_SIZE + i + 1}</Td>
                      <Td>{g.resident?.fullName ?? '—'}</Td>
                      <Td>{g.resident?.specialtyTitle ?? '—'}</Td>
                      <Td>{g.resident?.courseNumber != null ? `${g.resident.courseNumber}-kurs` : '—'}</Td>
                      <Td>{g.total}</Td>
                      <Td
                        title={
                          g.scoredCount > 0
                            ? `${g.scoredCount} ta ball qo‘yilgan dars bo‘yicha`
                            : undefined
                        }
                      >
                        {scoreAvgText(g.scoreAvg)}
                      </Td>
                      <Td style={{ whiteSpace: 'nowrap' }}>{day(g.lastDate)}</Td>
                      <Td>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          title="Batafsil"
                          onClick={() => navigate(`/residency/jurnal/${g.residentId}`)}
                        >
                          <MdVisibility />
                        </Btn>
                      </Td>
                    </Tr>
                  );
                })}
                {tarixRows.length === 0 && (
                  <Tr>
                    <Td colSpan={8} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                      {tarixFetching
                        ? 'Yuklanmoqda…'
                        : hasFilter
                          ? 'Filtrga mos dars topilmadi'
                          : "Ma'lumot topilmadi"}
                    </Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </TableWrap>
          <Pager page={tarixPage} totalPages={tarixTotalPages} onPage={setTarixPage} />
        </>
      ) : (
        <SessionList />
      )}

      <DetailModal record={viewing} onClose={() => setViewing(null)} />
      {announcing && (
        <AnnounceModal
          onClose={() => setAnnouncing(false)}
          onAnnounced={(id) => {
            setAnnouncing(false);
            if (id) navigate(sessionDetailPath(id));
            else setTab('mashgulotlar');
          }}
        />
      )}
    </>
  );
}

function DetailModal({ record, onClose }: { record: Attendance | null; onClose: () => void }) {
  return (
    <Modal open={!!record} onClose={onClose} title="Dars tafsiloti" width="480px">
      {record && (
        <ModalBody>
          <DetailField label="F.I.Sh" value={record.resident?.fullName ?? '—'} />
          <DetailField label="Fan" value={record.scienceTitle ?? '—'} />
          <DetailField label="Dars turi" value={lessonLabel(record.lessonType)} />
          <DetailField label="Sana" value={day(record.date)} />
          <DetailField label="O‘qituvchi" value={record.teacherName ?? '—'} />
          <DetailRow label="Davomat">
            <Badge variant={STATUS_VARIANT[record.status]}>{STATUS_LABEL[record.status]}</Badge>
            {record.late && <LateChip>{lateText(record.lateMinutes)}</LateChip>}
          </DetailRow>
          {record.status === 'excused' && (
            <DetailField label="Sabab" value={record.excuseReason ?? '—'} />
          )}
          <DetailField label="Kelgan / ketgan" value={clockRange(record)} />
          <DetailField label="Ball" value={ballText(record)} />
          <DetailRow label="Asos hujjati">
            {record.application?.fileUrl ? (
              <a
                href={record.application.fileUrl}
                target="_blank"
                rel="noreferrer"
                title={record.application.reason ?? undefined}
                style={{ color: '#1565C0', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <MdFileDownload size={14} /> Ariza hujjati
              </a>
            ) : (
              '—'
            )}
          </DetailRow>
        </ModalBody>
      )}
      <ModalFooter>
        <Btn $variant="ghost" onClick={onClose}>
          Yopish
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

const LateChip = styled.span`
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  color: #b9770e;
  background: #fdf2e2;
`;

const DRow = styled.div`
  display: flex;
  gap: 10px;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  &:last-child {
    border-bottom: none;
  }
`;
const DKey = styled.div`
  width: 120px;
  flex-shrink: 0;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;
const DVal = styled.div`
  color: ${({ theme }) => theme.colors.text};
`;
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DRow>
      <DKey>{label}</DKey>
      <DVal>{children}</DVal>
    </DRow>
  );
}
function DetailField({ label, value }: { label: string; value: string }) {
  return <DetailRow label={label}>{value}</DetailRow>;
}
