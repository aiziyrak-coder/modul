import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useCourses } from '../api/reference-api';
import { MdLink, MdPerson } from '../icons';
import { App, Input, Select } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import {
  PageTitle,
  Tabs,
  Tab,
  FilterBar,
  Btn,
  FormGroup,
  Label,
  HelperText,
} from '../components/common/FormElements';
import QueryNotice from '../components/common/QueryNotice';
import { combineState } from '../lib/query-state';
import { AsyncSelect } from '../components/common/AsyncSelect';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import Pager from '../components/common/Pager';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import SupervisorCardModal, { SupervisorInfo } from '../components/SupervisorCard';
import { useResidencyCapabilities } from '../lib/capabilities';
import { useDebouncedSearch } from '../lib/use-debounced';
import {
  limitSupervisorOptions,
  supervisorDepartmentLimit,
} from '../lib/supervisor-options';
import { usePermission } from '@/app/session';
import {
  useResidents,
  useSupervisorUsers,
  useSupervisorCard,
  useAssignSupervisor,
  useSpecialties,
} from '../api/residency-api';
import type { Program, Resident } from '../api/types';

const PAGE_SIZE = 10;
const supervisorLabelFor = (p: Program) => (p === 'magistratura' ? 'Ilmiy rahbar' : 'Klinik ustoz');
const courseText = (c: number | null) => (c != null ? `${c}-kurs` : '—');

const SUPERVISOR_ROLE_BY_PROGRAM: Record<Program, readonly string[]> = {
  magistratura: ['ilmiy_rahbar'],
  ordinatura: ['klinik_ustoz'],
};

export default function Biriktirish() {
  const { data: courses = [] } = useCourses();

  const { isOffice: canSeeSensitive } = useResidencyCapabilities();
  const can = usePermission();
  const canAssign = can('resident:update');
  const [program, setProgram] = useState<Program>('magistratura');
  const { data: specialties = [] } = useSpecialties(program);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [assigning, setAssigning] = useState<Resident | null>(null);
  const [viewingSupervisor, setViewingSupervisor] = useState<string | null>(null);

  const debouncedSearch = useDebouncedSearch(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const residentsQ = useResidents({
    program,
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    courseNumber: course || undefined,
    specialty: specialty || undefined,
  });
  const { data, isFetching } = residentsQ;
  const listState = combineState([residentsQ]);

  const resetPage = () => setPage(1);
  const switchProgram = (p: Program) => {
    setProgram(p);
    setSearch('');
    setCourse('');
    setSpecialty('');
    setPage(1);
  };

  const rows = data?.items ?? [];
  const totalPages = Math.max(1, data?.totalPages ?? 1);
  const hasFilter = !!(debouncedSearch || course || specialty);

  return (
    <div>
      <PageTitle>Biriktirish</PageTitle>

      <Tabs>
        <Tab $active={program === 'magistratura'} onClick={() => switchProgram('magistratura')}>
          Magistrantlar
        </Tab>
        <Tab $active={program === 'ordinatura'} onClick={() => switchProgram('ordinatura')}>
          Rezidentlar
        </Tab>
      </Tabs>

      <FilterBar>
        <Input
          placeholder="F.I.Sh bo'yicha qidirish..."
          value={search}
          style={{ width: 'auto', minWidth: 200 }}
          onChange={(e) => setSearch(e.target.value)}
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
            ...courses.map((c) => ({ value: String(c.number), label: c.title })),
          ]}
        />
        <Select
          value={specialty}
          showSearch
          optionFilterProp="label"
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => {
            setSpecialty(value);
            resetPage();
          }}
          options={[
            { value: '', label: 'Barcha mutaxassislik' },
            ...specialties.map((s) => ({ value: s.id, label: s.title })),
          ]}
        />
      </FilterBar>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>№</Th>
              <Th>F.I.Sh</Th>
              {canSeeSensitive && <Th>JSHSHIR</Th>}
              <Th>Ta'lim turi</Th>
              <Th>Mutaxassislik</Th>
              <Th>Kurs</Th>
              <Th>Kafedra</Th>
              <Th>{supervisorLabelFor(program)}</Th>
              <Th style={{ width: 96 }}>Dars soati</Th>
              {canAssign && <Th style={{ width: 150 }}>Amallar</Th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <Tr key={r.id}>
                <Td>{(page - 1) * PAGE_SIZE + i + 1}</Td>
                <Td style={{ fontWeight: 500 }}>{r.fullName}</Td>
                {canSeeSensitive && (
                  <Td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.jshshir || '—'}</Td>
                )}
                <Td>
                  {r.fundingType ? (
                    <Badge variant={r.fundingType === 'byudjet' ? 'byudjet' : 'shartnoma'}>
                      {r.fundingType === 'byudjet' ? 'Byudjet' : 'Shartnoma'}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>{r.specialtyTitle || '—'}</Td>
                <Td>{courseText(r.courseNumber)}</Td>
                <Td>{r.departmentTitle || '—'}</Td>
                <Td>
                  {r.supervisorName && r.supervisorId ? (
                    <SupervisorBtn
                      type="button"
                      title="Ustoz ma’lumotlarini ko‘rish"
                      onClick={() => setViewingSupervisor(r.supervisorId)}
                    >
                      <Badge variant="info">{r.supervisorName}</Badge>
                    </SupervisorBtn>
                  ) : r.supervisorName ? (
                    <Badge variant="info">{r.supervisorName}</Badge>
                  ) : (
                    <span style={{ color: '#BDC3C7' }}>—</span>
                  )}
                </Td>
                <Td>
                  {r.weeklyHours != null ? (
                    `${r.weeklyHours} soat`
                  ) : (
                    <span style={{ color: '#BDC3C7' }}>—</span>
                  )}
                </Td>
                {canAssign && (
                  <Td>
                    <Btn $variant="outline" $size="sm" onClick={() => setAssigning(r)}>
                      <MdLink size={14} /> Biriktirish
                    </Btn>
                  </Td>
                )}
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr>
                <Td
                  colSpan={(canSeeSensitive ? 10 : 9) - (canAssign ? 0 : 1)}
                  style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}
                >
                  {listState === 'forbidden' || listState === 'error' ? (
                    <QueryNotice
                      state={listState}
                      onRetry={() => void residentsQ.refetch()}
                      compact
                    />
                  ) : isFetching ? (
                    'Yuklanmoqda…'
                  ) : hasFilter ? (
                    <>
                      <MdPerson /> Filtrga mos talaba topilmadi
                    </>
                  ) : (
                    <>
                      <MdPerson /> Talaba topilmadi
                    </>
                  )}
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableWrap>

      <Pager page={page} totalPages={totalPages} onPage={setPage} />

      <SupervisorCardModal
        supervisorId={viewingSupervisor}
        onClose={() => setViewingSupervisor(null)}
      />

      <AssignModal
        key={assigning?.id ?? 'closed'}
        resident={assigning}
        program={program}
        onClose={() => setAssigning(null)}
      />
    </div>
  );
}

function AssignModal({
  resident,
  program,
  onClose,
}: {
  resident: Resident | null;
  program: Program;
  onClose: () => void;
}) {
  const { message } = App.useApp();

  const [supervisorSearch, setSupervisorSearch] = useState('');
  const { data: supervisors = [], isFetching: supervisorsLoading } = useSupervisorUsers(
    !!resident,
    supervisorSearch,
    SUPERVISOR_ROLE_BY_PROGRAM[program],
  );

  const { isOffice } = useResidencyCapabilities();
  const restrictToDepartment = supervisorDepartmentLimit(isOffice, resident);
  const supervisorOptions = useMemo(
    () => limitSupervisorOptions(supervisors, restrictToDepartment),
    [supervisors, restrictToDepartment],
  );
  const assignM = useAssignSupervisor();

  const [supervisorId, setSupervisorId] = useState('');
  const [teachingLocation, setTeachingLocation] = useState('');
  const [practiceLocation, setPracticeLocation] = useState('');
  const [scheduleText, setScheduleText] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const hoursRef = useRef<HTMLDivElement>(null);
  const [hoursError, setHoursError] = useState('');

  const supervisorCard = useSupervisorCard(supervisorId || null);
  const roleLabel = supervisorLabelFor(program);
  const title = `${roleLabel} biriktirish`;

  const submit = async () => {
    if (!resident || !supervisorId) return;

    const raw = weeklyHours.trim().replace(',', '.');
    let hours: number | null = null;
    if (raw !== '') {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 60) {
        const msg = 'Haftalik dars soati 0 va 60 orasida bo‘lishi kerak';
        setHoursError(msg);

        hoursRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        hoursRef.current?.querySelector('input')?.focus();
        message.error(msg);
        return;
      }
      if (!Number.isInteger(n * 2)) {
        setHoursError('Yarim soatlik qadam bilan kiriting (0, 0.5, 1, 1.5 …)');
        return;
      }
      hours = n;
    }
    setHoursError('');

    try {
      await assignM.mutateAsync({
        id: resident.id,
        data: {
          supervisorId,
          teachingLocation: teachingLocation.trim() || undefined,
          practiceLocation: practiceLocation.trim() || undefined,
          scheduleText: scheduleText.trim() || undefined,
          weeklyHours: hours,
        },
      });
      message.success('Biriktirildi');
      onClose();
    } catch (e) {
      message.error(getApiErrorMessage(e, 'Biriktirishda xatolik'));
    }
  };

  return (
    <Modal open={!!resident} onClose={onClose} title={title} width="480px">
      {resident && (
        <ModalBody>
          <InfoBox>
            <InfoRow>
              <InfoLbl>F.I.Sh</InfoLbl>
              <span style={{ fontWeight: 500 }}>{resident.fullName}</span>
            </InfoRow>
            <InfoRow>
              <InfoLbl>Mutaxassislik</InfoLbl>
              <span>{resident.specialtyTitle || '—'}</span>
            </InfoRow>
            <InfoRow style={{ borderBottom: 'none' }}>
              <InfoLbl>Kurs</InfoLbl>
              <span>{courseText(resident.courseNumber)}</span>
            </InfoRow>
          </InfoBox>

          {resident.supervisorName && (
            <div style={{ marginBottom: 14, fontSize: 13, color: '#475569' }}>
              Hozirgi: <Badge variant="info">{resident.supervisorName}</Badge>
            </div>
          )}

          <FormGroup>
            <Label>{roleLabel}ni tanlang</Label>
            <AsyncSelect
              value={supervisorId}
              onChange={(id) => setSupervisorId(id)}
              options={supervisorOptions.map((u) => ({ value: u.id, label: u.name }))}
              onSearch={setSupervisorSearch}
              loading={supervisorsLoading}
              placeholder="— Tanlang —"
              searchPlaceholder="F.I.Sh bo'yicha qidiring"
              notFoundText={
                restrictToDepartment
                  ? `Kafedrangizda «${roleLabel}» rolidagi foydalanuvchi topilmadi`
                  : `«${roleLabel}» rolidagi foydalanuvchi topilmadi`
              }
            />
          </FormGroup>

          {supervisorId && (
            <PickedBox>
              {supervisorCard.isLoading && <PickedMuted>Yuklanmoqda…</PickedMuted>}
              {supervisorCard.isError && (
                <PickedMuted>Ustoz ma’lumotini olib bo‘lmadi</PickedMuted>
              )}
              {supervisorCard.data && <SupervisorInfo card={supervisorCard.data} />}
            </PickedBox>
          )}

          <FormGroup>
            <Label>Dars o'tish joyi</Label>
            <Input
              placeholder="Masalan: 3-bino, 204-xona"
              value={teachingLocation}
              style={{ width: '100%' }}
              onChange={(e) => setTeachingLocation(e.target.value)}
            />
          </FormGroup>
          <FormGroup>
            <Label>Amaliyot joyi</Label>
            <Input
              placeholder="Masalan: 1-son klinika, Kardiologiya bo'limi"
              value={practiceLocation}
              style={{ width: '100%' }}
              onChange={(e) => setPracticeLocation(e.target.value)}
            />
          </FormGroup>
          <FormGroup>
            <Label>Dars jadvali</Label>
            <Input
              placeholder="Masalan: Du–Ju, 8:00–15:00"
              value={scheduleText}
              style={{ width: '100%' }}
              onChange={(e) => setScheduleText(e.target.value)}
            />
          </FormGroup>
          <FormGroup ref={hoursRef}>
            <Label>Haftalik dars soati</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Masalan: 6"
              status={hoursError ? 'error' : undefined}
              value={weeklyHours}
              onChange={(e) => {
                setWeeklyHours(e.target.value);
                if (hoursError) setHoursError('');
              }}
            />
            {hoursError && <HelperText $error>{hoursError}</HelperText>}
          </FormGroup>
        </ModalBody>
      )}
      <ModalFooter>
        <Btn $variant="ghost" onClick={onClose}>
          Bekor qilish
        </Btn>
        <Btn $variant="primary" disabled={!supervisorId || assignM.isPending} onClick={submit}>
          <MdLink size={15} /> Biriktirish
        </Btn>
      </ModalFooter>
    </Modal>
  );
}

const PickedBox = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 14px;
  background: ${({ theme }) => theme.colors.bg};
`;

const PickedMuted = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const SupervisorBtn = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
`;

const InfoBox = styled.div`
  background: ${({ theme }) => theme.colors.bg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
`;
const InfoRow = styled.div`
  display: flex;
  gap: 8px;
  font-size: 13px;
  padding: 4px 0;
  &:not(:last-child) {
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  }
`;
const InfoLbl = styled.span`
  width: 130px;
  flex-shrink: 0;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;
