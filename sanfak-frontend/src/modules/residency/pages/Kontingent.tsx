import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCourses } from '../api/reference-api';
import { MdAdd, MdUpload, MdVisibility, MdEdit, MdDelete, MdPerson } from '../icons';
import { App, Input, Select } from '@/shared/ui';
import { getApiErrorMessage } from '@/shared/api';
import {
  PageTitle,
  FilterBar,
  Btn,
  Tabs,
  Tab,
} from '../components/common/FormElements';
import { TableWrap, Table, Th, Td, Tr } from '../components/common/Table';
import Badge from '../components/common/Badge';
import Pager from '../components/common/Pager';
import Modal, { ModalBody, ModalFooter } from '../components/common/Modal';
import RosterImportModal from '../components/RosterImportModal';
import SupervisorCardModal from '../components/SupervisorCard';
import { useResidencyCapabilities } from '../lib/capabilities';
import { useDebouncedSearch } from '../lib/use-debounced';
import {
  useResidents,
  useMyResidents,
  useDeleteResident,
  useSpecialties,
} from '../api/residency-api';
import type { Program, Resident } from '../api/types';

const PAGE_SIZE = 10;
const mask = (v: string | null) => (v ? '*'.repeat(Math.max(4, v.length)) : '—');
const supervisorLabel = (p: Program) => (p === 'magistratura' ? 'Ilmiy rahbar' : 'Klinik ustoz');

export default function Kontingent() {
  const { message } = App.useApp();

  const { data: courses = [] } = useCourses();

  const navigate = useNavigate();
  const { isOffice: isAdmin, isMentor, isClinicalMentor } = useResidencyCapabilities();
  const canSeeSensitive = isAdmin;

  const [searchParams] = useSearchParams();
  const requested = searchParams.get('program');
  const [program, setProgram] = useState<Program>(
    !isMentor && (requested === 'magistratura' || requested === 'ordinatura')
      ? requested
      : isClinicalMentor
        ? 'ordinatura'
        : 'magistratura',
  );
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [course, setCourse] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [funding, setFunding] = useState('');
  const [foreign, setForeign] = useState('');
  const [viewing, setViewing] = useState<Resident | null>(null);
  const [toDelete, setToDelete] = useState<Resident | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [viewingSupervisor, setViewingSupervisor] = useState<Resident | null>(null);

  const { data: specialties = [] } = useSpecialties(program);
  const deleteM = useDeleteResident();

  const debouncedSearch = useDebouncedSearch(search);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const filters = {
    program,
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined,
    courseNumber: course || undefined,
    specialty: specialtyId || undefined,
    fundingType: funding || undefined,
    foreign: foreign === '' ? undefined : foreign === 'foreign',
  };

  const listQ = useResidents(filters, !isMentor);
  const myQ = useMyResidents({ program }, isMentor);

  const { rows, total } = useMemo(() => {
    if (isMentor) {
      const q = debouncedSearch.toLowerCase();
      const all = (myQ.data ?? []).filter((r) => !q || r.fullName.toLowerCase().includes(q));
      return { rows: all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total: all.length };
    }
    return { rows: listQ.data?.items ?? [], total: listQ.data?.total ?? 0 };
  }, [isMentor, myQ.data, listQ.data, debouncedSearch, page]);

  const isFetching = isMentor ? myQ.isFetching : listQ.isFetching;
  const hasFilter = !!(debouncedSearch || course || specialtyId || funding || foreign);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const resetPage = () => setPage(1);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteM.mutateAsync(toDelete.id);
      message.success('O‘chirildi');
    } catch (e) {
      message.error(getApiErrorMessage(e, 'O‘chirishda xatolik'));
    }
    setToDelete(null);
  };

  return (
    <div>
      <PageTitle>Kontingent</PageTitle>

      {!isMentor && (
        <Tabs>
          <Tab
            $active={program === 'magistratura'}
            onClick={() => {
              setProgram('magistratura');
              resetPage();
            }}
          >
            Magistrantlar
          </Tab>
          <Tab
            $active={program === 'ordinatura'}
            onClick={() => {
              setProgram('ordinatura');
              resetPage();
            }}
          >
            Rezidentlar
          </Tab>
        </Tabs>
      )}

      <FilterBar>
        <Input
          placeholder="F.I.Sh bo‘yicha qidirish..."
          aria-label="F.I.Sh bo‘yicha qidirish"
          value={search}
          style={{ width: 'auto', minWidth: 200 }}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!isMentor && (
          <>
        <Select
          aria-label="Kurs bo‘yicha filtr"
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
          aria-label="Mutaxassislik bo‘yicha filtr"
          value={specialtyId}
          showSearch
          optionFilterProp="label"
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => {
            setSpecialtyId(value);
            resetPage();
          }}
          options={[
            { value: '', label: 'Barcha mutaxassislik' },
            ...specialties.map((s) => ({ value: s.id, label: s.title })),
          ]}
        />
        <Select
          aria-label="Ta’lim turi bo‘yicha filtr"
          value={funding}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => {
            setFunding(value);
            resetPage();
          }}
          options={[
            { value: '', label: 'Ta’lim turi' },
            { value: 'byudjet', label: 'Byudjet' },
            { value: 'shartnoma', label: 'Shartnoma' },
          ]}
        />
        <Select
          aria-label="Mansublik bo‘yicha filtr"
          value={foreign}
          style={{ width: 'auto', minWidth: 150 }}
          onChange={(value) => {
            setForeign(value);
            resetPage();
          }}
          options={[
            { value: '', label: 'Mansublik' },
            { value: 'local', label: 'Mahalliy' },
            { value: 'foreign', label: 'Xorijiy' },
          ]}
        />
          </>
        )}
        {isAdmin && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn $variant="ghost" onClick={() => setImportOpen(true)}>
              <MdUpload /> Excel‘dan yuklash
            </Btn>
            <Btn $variant="primary" onClick={() => navigate('/residency/kontingent/yangi')}>
              <MdAdd /> Talaba qo‘shish
            </Btn>
          </div>
        )}
      </FilterBar>

      <TableWrap>
        <Table>
          <thead>
            <tr>
              <Th style={{ width: 48 }}>#</Th>
              <Th>F.I.Sh</Th>
              {canSeeSensitive && <Th>JSHSHIR</Th>}
              <Th>Ta’lim turi</Th>
              <Th>Mutaxassislik</Th>
              <Th>Kurs</Th>
              <Th>Muddat</Th>
              <Th>Kafedra</Th>
              <Th>{supervisorLabel(program)}</Th>
              <Th style={{ width: 130 }}>Amallar</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <Tr key={r.id}>
                <Td>{(page - 1) * PAGE_SIZE + i + 1}</Td>
                <Td>{r.fullName}</Td>
                {canSeeSensitive && <Td style={{ fontFamily: 'monospace' }}>{r.jshshir || '—'}</Td>}
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
                <Td>{r.courseNumber ?? '—'}</Td>
                <Td>{r.studyPeriod != null ? `${r.studyPeriod} yil` : '—'}</Td>
                <Td>{r.departmentTitle || '—'}</Td>
                <Td>
                  {r.supervisorName && r.supervisorId ? (
                    <SupervisorBtn
                      type="button"
                      title="Ustoz ma’lumotlarini ko‘rish"
                      onClick={() => setViewingSupervisor(r)}
                    >
                      {r.supervisorName}
                    </SupervisorBtn>
                  ) : (
                    r.supervisorName || <span style={{ color: '#BDC3C7' }}>Biriktirilmagan</span>
                  )}
                </Td>
                <Td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn $variant="ghost" $size="sm" onClick={() => setViewing(r)} title="Ko‘rish">
                      <MdVisibility />
                    </Btn>
                    {isAdmin && (
                      <>
                        <Btn
                          $variant="ghost"
                          $size="sm"
                          onClick={() => navigate(`/residency/kontingent/tahrir/${r.id}`)}
                          title="Tahrirlash"
                        >
                          <MdEdit />
                        </Btn>
                        <Btn $variant="ghost" $size="sm" onClick={() => setToDelete(r)} title="O‘chirish">
                          <MdDelete />
                        </Btn>
                      </>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 && (
              <Tr>
                <Td colSpan={canSeeSensitive ? 10 : 9} style={{ textAlign: 'center', color: '#7F8C8D', padding: 32 }}>
                  {isFetching ? (
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
        supervisorId={viewingSupervisor?.supervisorId ?? null}
        workplaceLocation={viewingSupervisor?.workplaceLocation ?? null}
        onClose={() => setViewingSupervisor(null)}
      />

      <RosterImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void listQ.refetch()}
      />

      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Talaba ma’lumotlari" width="520px">
        {viewing && (
          <ModalBody>
            <InfoGrid>
              <Info label="F.I.Sh" value={viewing.fullName} />
              <Info label="JSHSHIR" value={canSeeSensitive ? viewing.jshshir : mask(viewing.jshshir)} />
              <Info
                label="Pasport"
                value={
                  canSeeSensitive
                    ? [viewing.passportSeria, viewing.passportNumber].filter(Boolean).join(' ') || '—'
                    : mask(viewing.passportNumber)
                }
              />
              <Info label="Manzil" value={viewing.address} />
              <Info label="Ish joyi" value={viewing.workplace} />
              <InfoRow>
                <InfoLabel>Ish joyi joylashuvi</InfoLabel>
                <InfoValue>
                  {viewing.workplaceLocation ? (
                    <MapLink
                      href={`https://www.google.com/maps?q=${viewing.workplaceLocation.lat},${viewing.workplaceLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {viewing.workplaceLocation.lat}, {viewing.workplaceLocation.lng}
                    </MapLink>
                  ) : (
                    '—'
                  )}
                </InfoValue>
              </InfoRow>
              <Info
                label="Ta’lim turi"
                value={viewing.fundingType === 'byudjet' ? 'Byudjet' : viewing.fundingType === 'shartnoma' ? 'Shartnoma' : '—'}
              />
              <Info label="Mutaxassislik" value={viewing.specialtyTitle} />
              <Info label="Kurs" value={viewing.courseNumber?.toString()} />
              <Info
                label="O‘qish muddati"
                value={viewing.studyPeriod != null ? `${viewing.studyPeriod} yil` : null}
              />
              <Info label="Kafedra" value={viewing.departmentTitle} />
              <Info label="Email" value={viewing.email} />
              <Info label="Telefon" value={viewing.phone} />
              <Info label={supervisorLabel(viewing.program)} value={viewing.supervisorName} />
            </InfoGrid>
          </ModalBody>
        )}
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setViewing(null)}>
            Yopish
          </Btn>
        </ModalFooter>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="O‘chirishni tasdiqlang" width="400px">
        <ModalBody>
          <div style={{ fontSize: 13, color: '#475569' }}>
            <b>{toDelete?.fullName}</b> yozuvini o‘chirmoqchimisiz?
          </div>
        </ModalBody>
        <ModalFooter>
          <Btn $variant="ghost" onClick={() => setToDelete(null)}>
            Bekor qilish
          </Btn>
          <Btn $variant="danger" onClick={confirmDelete} disabled={deleteM.isPending}>
            O‘chirish
          </Btn>
        </ModalFooter>
      </Modal>
    </div>
  );
}

import styled from 'styled-components';
const SupervisorBtn = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: underline;
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px 20px;
`;
const InfoRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;
const InfoLabel = styled.span`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;
const InfoValue = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
`;
const MapLink = styled.a`
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: underline;
`;

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <InfoRow>
      <InfoLabel>{label}</InfoLabel>
      <InfoValue>{value || '—'}</InfoValue>
    </InfoRow>
  );
}
