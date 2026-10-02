import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Select } from '@/shared/ui';
import { useScholarships, useApplications, useProfile, useAcademicYears } from '../../api/gifted-api';
import Loader from '../../components/common/Loader';
import { MdArrowForward, MdCalendarToday, MdPaid } from '../../icons';
import { DEFAULT_ACADEMIC_YEAR } from '../../lib/academic-years';
import { useYearFilter } from '../../lib/default-year';


export default function JudgeScholarships() {
  const navigate = useNavigate();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: scholarships = [], isLoading: scholarshipsLoading } = useScholarships('rektor');
  const { data: applications = [] } = useApplications();
  const { data: academicYearRows = [] } = useAcademicYears();
  const academicYears = academicYearRows.map((y) => y.title);

  const myId = profile?._id;

  const isLoading = profileLoading || scholarshipsLoading;

  const allMyScholarships = scholarships.filter(
    s => !!myId && !!s.judges?.includes(myId)
  );

  const [yearFilter, setYearFilter] = useYearFilter(
    allMyScholarships.map(s => s.academicYear || DEFAULT_ACADEMIC_YEAR),
  );

  const availableYears = [...new Set([
    ...academicYears,
    ...allMyScholarships.map(s => s.academicYear || DEFAULT_ACADEMIC_YEAR),
  ].filter(Boolean))].sort((a, b) => b.localeCompare(a));

  const myScholarships = allMyScholarships.filter(
    s => yearFilter === 'all' || (s.academicYear || DEFAULT_ACADEMIC_YEAR) === yearFilter
  );

  return (
    <>
      <TopBar>
        <YearLabel>O'quv yili:</YearLabel>
        <Select
          value={yearFilter}
          style={{ width: 'auto', minWidth: 180 }}
          onChange={(value) => setYearFilter(value)}
          options={[
            { value: 'all', label: "Barcha o'quv yillari" },
            ...availableYears.map((y) => ({ value: y, label: y })),
          ]}
        />
      </TopBar>

      {isLoading ? (
        <Loader text="Yo'nalishlar yuklanmoqda..." />
      ) : myScholarships.length === 0 ? (
        <Empty>
          {allMyScholarships.length === 0
            ? "Sizga birorta yo'nalish biriktirilmagan"
            : `${yearFilter === 'all' ? 'Tanlangan' : yearFilter} o'quv yili uchun yo'nalish topilmadi`}
        </Empty>
      ) : (
        <Grid>
          {myScholarships.map(sch => {
            const apps = applications.filter(a => a.scholarshipId === sch.id);
            const judges = sch.judges ?? [];
            const myScored = apps.filter(a => !!myId && a.judgeScores?.[myId] != null).length;
            const allJudgesScored = judges.length > 0 && apps.length > 0 &&
              apps.every(a => judges.every(jId => a.judgeScores?.[jId] != null));

            return (
              <SchCard key={sch.id} onClick={() => navigate(`/gifted-students/judge/scholarships/${sch.id}`)}>
                <SchTop>
                  <SchName>{sch.name}</SchName>
                  <Arrow><MdArrowForward /></Arrow>
                </SchTop>

                <SchMeta>
                  <MetaItem><MdCalendarToday /> {sch.deadline}</MetaItem>
                  <MetaItem><MdPaid /> {sch.amount}</MetaItem>
                </SchMeta>

                <SchFooter>
                  <ApplicantCount>{apps.length} talabgor</ApplicantCount>
                  {apps.length === 0 ? (
                    <StatusChip $neutral>Ariza yo'q</StatusChip>
                  ) : allJudgesScored ? (
                    <StatusChip $finalized>Baholash yakunlandi</StatusChip>
                  ) : (
                    <StatusChip $progress>{myScored}/{apps.length} baholandi</StatusChip>
                  )}
                </SchFooter>
              </SchCard>
            );
          })}
        </Grid>
      )}
    </>
  );
}

const TopBar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
`;

const YearLabel = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
`;

const SchCard = styled.div`
  background: white;
  border-radius: 14px;
  border: 1.5px solid ${({ theme }) => theme.colors.border};
  padding: 20px;
  cursor: pointer;
  transition: all 0.18s;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 4px 16px rgba(39,174,96,0.12);
    transform: translateY(-2px);
  }
`;

const SchTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
`;

const SchName = styled.h3`
  font-size: 15px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.4;
`;

const Arrow = styled.div`
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
`;

const SchMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
  svg { font-size: 14px; }
`;

const SchFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const ApplicantCount = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const StatusChip = styled.span<{ $finalized?: boolean; $progress?: boolean; $neutral?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;

  ${({ $finalized }) => $finalized && `
    background: #DBEAFE; color: #1D4ED8;
  `}
  ${({ $progress }) => $progress && `
    background: #DCFCE7; color: #15803D;
  `}
  ${({ $neutral }) => $neutral && `
    background: #F1F5F9; color: #64748B;
  `}
`;

const Empty = styled.div`
  text-align: center;
  padding: 60px 20px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
