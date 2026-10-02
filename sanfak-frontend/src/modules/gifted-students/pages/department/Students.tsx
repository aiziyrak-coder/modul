import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Input, Select } from '@/shared/ui';
import { usePermission } from '@/app/session';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import RosterImportModal from './RosterImportModal';
import { useToast } from '../../components/common/Toast';
import Loader from '../../components/common/Loader';
import { useStudents, useDeleteStudent, useFaculties, useAdvisorUsers, useAcademicYears, useCourses } from '../../api/gifted-api';
import type { StudentRecord } from '../../data/types';
import { courseNumbers } from '../../lib/courses';
import { normalizeSearch } from '../../lib/use-debounced';
import {
  MdAdd, MdVisibility, MdEdit, MdDelete, MdSearch,
  MdPerson, MdUploadFile,
} from '../../icons';


const formatAdvisorName = (fullName: string): string => {
  if (!fullName) return '';
  const parts = fullName.trim().split(' ');
  const last = parts[0] || '';
  const initials = parts.slice(1).map(p => (p[0] ? `${p[0]}.` : '')).join('');
  return `${last} ${initials}`.trim();
};

export default function DepartmentStudents() {
  const { data: courseRows = [] } = useCourses();

  const { toast } = useToast();
  const navigate = useNavigate();
  const can = usePermission();
  const canCreate = can('giftedStudent:create');
  const canUpdate = can('giftedStudent:update');
  const canDelete = can('giftedStudent:delete');

  const { data: facultyRefs = [] } = useFaculties();
  const { data: advisors = [] } = useAdvisorUsers();
  const deleteStudent = useDeleteStudent();
  const deleting = deleteStudent.isPending;
  const { data: academicYearRows = [] } = useAcademicYears();
  const academicYears = academicYearRows.map((y) => y.title);

  const [search, setSearch] = useState('');
  const [filterFaculty, setFilterFaculty] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  const facultyParam = filterFaculty === 'all'
    ? undefined
    : facultyRefs.find((f) => f.title === filterFaculty)?.id ?? filterFaculty;

  const { data: students = [], isLoading, isFetching, refetch: refetchStudents } = useStudents(true, {
    faculty: facultyParam,
    course: filterCourse,
    academicYear: filterYear,
  });

  const [modal, setModal] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRecord | null>(null);

  const faculties = [...new Set([
    ...facultyRefs.map(f => f.title),
    ...students.map(s => s.faculty).filter(Boolean),
    ...(filterFaculty !== 'all' ? [filterFaculty] : []),
  ])].sort();
  const courses = courseNumbers(courseRows);

  const advisorDegree = new Map(advisors.filter(a => a.degree).map(a => [a.id, a.degree as string]));

  const advisorLive = new Map(advisors.map(a => [a.id, a.name]));
  const advisorLabel = (advisorId: string, advisorName: string) => {
    const n = formatAdvisorName(advisorLive.get(advisorId) ?? advisorName);
    const d = advisorDegree.get(advisorId);
    return d ? `${d} ${n}` : n;
  };

  const q = normalizeSearch(search).toLowerCase();
  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.advisorName || '').toLowerCase().includes(q)
  );

  const hasFilter = q !== '' || filterFaculty !== 'all' || filterCourse !== 'all' || filterYear !== 'all';

  const [importOpen, setImportOpen] = useState(false);

  const openAdd = () => navigate('/gifted-students/department/students/new');
  const openEdit = (s: StudentRecord) => navigate(`/gifted-students/department/students/edit/${s.id}`);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteStudent.mutate(deleteTarget.id, { onSuccess: () => {
      setDeleteTarget(null);
      setModal(null);
      toast("Talaba o'chirildi", 'info');
    } });
  };

  return (
    <>
      <Wrap>
        <TopBar>
          <SearchWrap>
            <Input
              value={search}
              style={{ width: '100%' }}
              allowClear
              prefix={<MdSearch />}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="FISh yoki maslahatchi bo'yicha qidirish..."
            />
          </SearchWrap>
          <Filters>
            <Select
              value={filterYear}
              style={{ width: 'auto', minWidth: 180 }}
              onChange={(value: string) => setFilterYear(value)}
              options={[
                { value: 'all', label: "Barcha o'quv yillari" },
                ...academicYears.map(y => ({ value: y, label: y })),
              ]}
            />
            <Select
              value={filterFaculty}
              showSearch
              optionFilterProp="label"
              style={{ width: 'auto', minWidth: 200 }}
              onChange={(value: string) => setFilterFaculty(value)}
              options={[
                { value: 'all', label: 'Barcha fakultetlar' },
                ...faculties.map(f => ({ value: f, label: f })),
              ]}
            />
            <Select
              value={filterCourse}
              style={{ width: 'auto', minWidth: 150 }}
              onChange={(value: string) => setFilterCourse(value)}
              options={[
                { value: 'all', label: 'Barcha kurslar' },
                ...courses.map(c => ({ value: String(c), label: `${c}-kurs` })),
              ]}
            />
          </Filters>

          <Actions>
            {canCreate && (
              <>
                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                  <MdUploadFile /> Excel'dan yuklash
                </Button>
                <Button onClick={openAdd}><MdAdd /> Talaba qo'shish</Button>
              </>
            )}
          </Actions>
        </TopBar>

        <CountRow>
          Jami: <b>{filtered.length}</b> ta talaba
          {isFetching && !isLoading && <Updating>yangilanmoqda...</Updating>}
        </CountRow>

        <TableWrap>
          <StyledTable>
            <thead>
              <tr>
                <Th style={{ width: 40 }}>№</Th>
                <Th>FISh</Th>
                <Th>Maslahatchi</Th>
                <Th>Fakultet</Th>
                <Th>Yo'nalish</Th>
                <Th style={{ width: 70 }}>Kurs</Th>
                <Th style={{ width: 80 }}>Guruh</Th>
                <Th style={{ width: 80 }}>Batafsil</Th>
                <Th style={{ width: 90 }}>Amallar</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <EmptyTd colSpan={9}><Loader text="Talabalar yuklanmoqda..." /></EmptyTd>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <EmptyTd colSpan={9}>
                    <EmptyState>
                      <MdPerson style={{ fontSize: 40, color: '#BDC3C7' }} />
                      <p>{hasFilter ? "Qidiruv yoki filtrga mos talaba topilmadi" : "Talaba topilmadi"}</p>
                    </EmptyState>
                  </EmptyTd>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <Tr key={s.id}>
                    <Td><Num>{i + 1}</Num></Td>
                    <Td>
                      <NameCell>
                        <Avatar>{s.name[0] ?? ''}</Avatar>
                        <NameInfo>
                          <NameText title={s.name}>{s.name}</NameText>
                        </NameInfo>
                      </NameCell>
                    </Td>
                    <Td>
                      {s.advisorName
                        ? <AdvisorCell>
                            <AdvisorDot />
                            <span>{advisorLabel(s.advisorId, s.advisorName)}</span>
                          </AdvisorCell>
                        : <NoAdvisor>— biriktirilmagan</NoAdvisor>
                      }
                    </Td>
                    <Td><FacultyText>{s.faculty}</FacultyText></Td>
                    <Td><span style={{ fontSize: 12, color: '#7F8C8D' }}>{s.direction}</span></Td>
                    <Td>{s.course}-kurs</Td>
                    <Td>{s.group}</Td>
                    <Td>
                      <IconBtn
                        title="Batafsil ko'rish"
                        onClick={() => navigate(`/gifted-students/department/students/${s.id}`)}
                      >
                        <MdVisibility />
                      </IconBtn>
                    </Td>
                    <Td>
                      <ActionGroup>
                        {canUpdate && (
                          <IconBtn $edit title="Tahrirlash" onClick={() => openEdit(s)}>
                            <MdEdit />
                          </IconBtn>
                        )}
                        {canDelete && (
                          <IconBtn $danger title="O'chirish"
                            onClick={() => { setDeleteTarget(s); setModal('delete'); }}>
                            <MdDelete />
                          </IconBtn>
                        )}
                        {!canUpdate && !canDelete && <Dash>—</Dash>}
                      </ActionGroup>
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </StyledTable>
        </TableWrap>
      </Wrap>

      <RosterImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refetchStudents}
      />

      <Modal
        open={modal === 'delete'}
        onClose={() => setModal(null)}
        title="Talabani o'chirish"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Bekor qilish</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>O'chirish</Button>
          </>
        }
      >
        <p style={{ fontSize: 14, color: '#2C3E50', lineHeight: 1.6 }}>
          <b>{deleteTarget?.name}</b> talabani ro'yxatdan o'chirmoqchimisiz?
          <br />
          <span style={{ fontSize: 13, color: '#E74C3C' }}>⚠ Bu amalni bekor qilib bo'lmaydi.</span>
        </p>
      </Modal>
    </>
  );
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const SearchWrap = styled.div`
  flex: 1;
  min-width: 220px;
`;

const Filters = styled.div`
  display: flex;
  gap: 8px;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const CountRow = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  b { color: ${({ theme }) => theme.colors.text}; }
`;

const Updating = styled.span`
  margin-left: 8px;
  font-style: italic;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TableWrap = styled.div`
  background: white;
  border-radius: ${({ theme }) => theme.radius.lg};
  border: 1px solid ${({ theme }) => theme.colors.border};
  overflow-x: auto;
  box-shadow: ${({ theme }) => theme.shadow.sm};
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Th = styled.th`
  padding: 11px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  background: ${({ theme }) => theme.colors.bg};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  white-space: nowrap;
`;

const Tr = styled.tr`
  transition: background 0.1s;
  &:not(:last-child) td { border-bottom: 1px solid ${({ theme }) => theme.colors.border}; }
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
`;

const Td = styled.td`
  padding: 11px 14px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  vertical-align: middle;
`;

const EmptyTd = styled.td`
  padding: 48px;
  text-align: center;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  p { font-size: 13px; color: ${({ theme }) => theme.colors.textMuted}; }
`;

const Num = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-weight: 600;
`;

const NameCell = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Avatar = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--brand-primary), var(--brand-primary-hover));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
`;

const NameInfo = styled.div`
  min-width: 0;
`;
const NameText = styled.div`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  font-size: 13px;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AdvisorCell = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.text};
`;
const AdvisorDot = styled.div`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--brand-primary);
  flex-shrink: 0;
`;
const NoAdvisor = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  font-style: italic;
`;

const FacultyText = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.text};
`;

const IconBtn = styled.button<{ $danger?: boolean; $edit?: boolean }>`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  color: ${({ $danger, $edit, theme }) =>
    $danger ? theme.colors.danger : $edit ? theme.colors.info : theme.colors.textMuted};
  background: ${({ $danger, $edit, theme }) =>
    $danger ? theme.colors.dangerLight : $edit ? theme.colors.infoLight : theme.colors.bg};
  transition: opacity 0.15s;
  &:hover { opacity: 0.7; }
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 5px;
`;

const Dash = styled.span`
  color: #BDC3C7;
`;
