import { useNavigate, useParams, Navigate } from 'react-router-dom';
import styled from 'styled-components';
import { CardWrap } from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import { useScholarship, useApplications, useStudents, useScholarshipApplicants, useCourses } from '../../api/gifted-api';
import Loader from '../../components/common/Loader';
import { courseLabel as courseLabelOf } from '../../lib/courses';
import {
  MdArrowBack, MdPaid, MdCalendarToday, MdTrendingUp, MdGroups, MdPerson, MdDateRange,
} from '../../icons';


export default function NomdorDetail() {
  const { data: courseRows = [] } = useCourses();
  const courseLabel = (v: string): string => courseLabelOf(courseRows, v);

  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: sch, isLoading } = useScholarship(id);
  const isStudent = user?.role === 'student';
  const { data: allApplications = [] } = useApplications(!isStudent);
  const { data: students = [] } = useStudents(!isStudent);
  const { data: publicApplicants = [] } = useScholarshipApplicants(isStudent ? id : undefined);

  if (isLoading) return <Loader text="Yuklanmoqda..." />;
  if (!sch || sch.type !== 'nomdor') {
    return <Navigate to={isStudent ? '/gifted-students/student/scholarships/nomdor' : '/gifted-students/department/scholarships/nomdor'} replace />;
  }

  const backPath = isStudent ? '/gifted-students/student/scholarships/nomdor' : '/gifted-students/department/scholarships/nomdor';
  const detailBackPath = isStudent ? `/gifted-students/student/scholarships/nomdor/${id}` : `/gifted-students/department/scholarships/nomdor/${id}`;

  const apps = allApplications.filter(
    a => a.scholarshipId === id && (a.status === 'recommended' || a.status === 'approved')
  );

  const rows: Array<{ id: string; name: string; faculty: string; direction: string; course: number | string; group: string; studentId: string }> =
    isStudent
      ? publicApplicants.map(a => ({
          id: a.id, name: a.name, faculty: a.faculty, direction: a.direction,
          course: a.course, group: a.group, studentId: a.id,
        }))
      : apps.map(app => {
          const s = students.find(x => x.id === app.studentId);
          return {
            id: app.id,
            name: s?.name ?? app.studentName ?? '',
            faculty: s?.faculty ?? app.faculty ?? '',
            direction: s?.direction ?? app.direction ?? '',
            course: s?.course ?? app.course ?? 0,
            group: s?.group ?? app.group ?? '',
            studentId: app.studentId,
          };
        });

  return (
    <PageWrap>

      <BackBar>
        <BackBtn onClick={() => navigate(backPath)}>
          <MdArrowBack /> Nomdor stipendiyalarga qaytish
        </BackBtn>
      </BackBar>

      <InfoCard>
        <InfoTitle>{sch.name}</InfoTitle>
        {sch.description && <InfoDesc>{sch.description}</InfoDesc>}
        <MetaRow>
          <MetaCell>
            <MetaIcon $bg="var(--brand-primary-soft)" $color="var(--brand-primary)"><MdPaid /></MetaIcon>
            <MetaText><MetaLabel>Miqdor</MetaLabel><MetaValue>{sch.amount}</MetaValue></MetaText>
          </MetaCell>
          <MetaCell>
            <MetaIcon $bg="#EBF5FB" $color="#3498DB"><MdTrendingUp /></MetaIcon>
            <MetaText><MetaLabel>Min. ball</MetaLabel><MetaValue>{sch.minScore}</MetaValue></MetaText>
          </MetaCell>
          <MetaCell>
            <MetaIcon $bg="#FDEDEC" $color="#E74C3C"><MdCalendarToday /></MetaIcon>
            <MetaText><MetaLabel>Muddat</MetaLabel><MetaValue>{sch.deadline}</MetaValue></MetaText>
          </MetaCell>
          {sch.academicYear && (
            <MetaCell>
              <MetaIcon $bg="#F3E8FF" $color="#7C3AED"><MdDateRange /></MetaIcon>
              <MetaText><MetaLabel>O'quv yili</MetaLabel><MetaValue>{sch.academicYear}</MetaValue></MetaText>
            </MetaCell>
          )}
        </MetaRow>
        {(sch.allowedCourses?.length ?? 0) > 0 && (
          <InfoSection>
            <InfoSectionLabel><MdGroups /> Kim ariza topshira oladi</InfoSectionLabel>
            <ChipsRow>
              {sch.allowedCourses?.map(c => <Chip key={c}>{courseLabel(c)}</Chip>)}
            </ChipsRow>
          </InfoSection>
        )}
      </InfoCard>

      <ApplicantsCard>
        <ApplicantsHeader>
          <ApplicantsTitle>Tasdiqlangan arizachilar</ApplicantsTitle>
          <ApplicantsCount>{rows.length} ta</ApplicantsCount>
        </ApplicantsHeader>

        {rows.length === 0 ? (
          <EmptyState>
            <EmptyIcon>📭</EmptyIcon>
            <EmptyText>Tasdiqlangan arizalar mavjud emas</EmptyText>
          </EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <Tr $header>
                  <Th>#</Th>
                  <Th>FISH</Th>
                  <Th>Fakultet</Th>
                  <Th>Yo'nalish</Th>
                  <Th>Kurs</Th>
                  <Th>Guruh</Th>
                  <Th>Faoliyat</Th>
                </Tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <Tr key={row.id}>
                    <Td>{idx + 1}</Td>
                    <Td>
                      <StudentName>{row.name || row.studentId}</StudentName>
                    </Td>
                    <Td>{row.faculty || '—'}</Td>
                    <Td>{row.direction || '—'}</Td>
                    <Td>{row.course ? `${row.course}-kurs` : '—'}</Td>
                    <Td>{row.group || '—'}</Td>
                    <Td>
                      {!isStudent && (
                        <IconBtn
                          onClick={() => navigate(`/gifted-students/department/students/${row.studentId}`, {
                            state: { back: detailBackPath }
                          })}
                          title="Faoliyatlar"
                        >
                          <MdPerson />
                        </IconBtn>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </ApplicantsCard>

    </PageWrap>
  );
}

const PageWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const BackBar = styled.div`
  display: flex;
  align-items: center;
`;

const BackBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.primary};
  padding: 6px 10px;
  border-radius: ${({ theme }) => theme.radius.md};
  transition: background 0.15s;
  &:hover { background: ${({ theme }) => theme.colors.primaryLight}; }
  svg { font-size: 18px; }
`;

const InfoCard = styled(CardWrap)`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const InfoTitle = styled.h2`
  font-size: 20px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const InfoDesc = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 1.6;
`;

const MetaRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 14px;
  background: ${({ theme }) => theme.colors.bg};
  border-radius: ${({ theme }) => theme.radius.md};
`;

const MetaCell = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const MetaIcon = styled.div<{ $bg: string; $color: string }>`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
`;

const MetaText = styled.div``;

const MetaLabel = styled.div`
  font-size: 11px;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const MetaValue = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
`;

const InfoSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const InfoSectionLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  svg { font-size: 16px; }
`;

const ChipsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  border: 1px solid #A9DFBF;
`;

const ApplicantsCard = styled(CardWrap)`
  padding: 0;
  overflow: hidden;
`;

const ApplicantsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const ApplicantsTitle = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
`;

const ApplicantsCount = styled.span`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const TableWrap = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Tr = styled.tr<{ $header?: boolean }>`
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  ${({ $header }) => !$header && `
    &:hover { background: #F8FAFC; }
    &:last-child { border-bottom: none; }
  `}
`;

const Th = styled.th`
  padding: 10px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: ${({ theme }) => theme.colors.bg};
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 12px 16px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
  vertical-align: middle;
`;

const StudentName = styled.div`
  font-weight: 600;
`;

const IconBtn = styled.button`
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #7F8C8D;
  background: #F4F6F9;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #EBF5FB; color: #3498DB; }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 20px;
  text-align: center;
`;

const EmptyIcon = styled.div`font-size: 40px;`;

const EmptyText = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
