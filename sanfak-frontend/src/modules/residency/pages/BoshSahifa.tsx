import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { usePermission } from '@/app/session';
import { MdGroups, MdDescription, MdSchool, MdCalendarToday, MdAssignment, MdLink, MdEvent } from '../icons';
import { PageTitle, SectionTitle, StatCards, Btn } from '../components/common/FormElements';
import QueryNotice from '../components/common/QueryNotice';
import { combineState } from '../lib/query-state';
import StatCard from '../components/common/StatCard';
import { useAuth } from '../context/AuthContext';
import { useResidencyCapabilities } from '../lib/capabilities';
import {
  useResidents,
  useApplicationStats,
  useDailyLogStats,
  useMyResidents,
  useMyResident,
} from '../api/residency-api';
import { activityPlanHooks, dissertationPlanHooks } from '../api/plan-api';

interface QuickLink {
  path: string;
  label: string;
  icon: ReactNode;
  permission: string;
}

const LINK = {
  kontingent: { path: '/residency/kontingent', label: 'Kontingent', icon: <MdGroups />, permission: 'resident:readAll' },
  biriktirish: { path: '/residency/biriktirish', label: 'Biriktirish', icon: <MdLink />, permission: 'resident:readAll' },
  mutaxassisliklar: { path: '/residency/mutaxassisliklar', label: 'Mutaxassisliklar', icon: <MdSchool />, permission: 'residencySpecialty:readAll' },
  davomat: { path: '/residency/davomat', label: 'Davomat', icon: <MdCalendarToday />, permission: 'residentAttendance:readAll' },
  kundalik: { path: '/residency/kundalik', label: 'Kundalik', icon: <MdAssignment />, permission: 'residentDailyLog:readAll' },
  arizalar: { path: '/residency/arizalar', label: 'Arizalar', icon: <MdDescription />, permission: 'residentApplication:readAll' },
  faoliyatRejasi: { path: '/residency/faoliyat-rejasi', label: 'Faoliyat rejasi', icon: <MdAssignment />, permission: 'residencyActivityPlan:create' },
  dissertatsiya: { path: '/residency/dissertatsiya', label: 'Dissertatsiya', icon: <MdSchool />, permission: 'residencyDissertationPlan:create' },
  kalendarRejalar: { path: '/residency/kalendar-ish-rejalar', label: 'Kalendar ish rejalar', icon: <MdEvent />, permission: 'residencyActivityPlan:approve' },
} satisfies Record<string, QuickLink>;

function QuickLinks({ items }: { items: QuickLink[] }) {
  const can = usePermission();
  const allowed = items.filter((l) => can(l.permission));
  if (allowed.length === 0) return null;

  return (
    <Card>
      <SectionTitle>Tezkor havolalar</SectionTitle>
      <QuickRow>
        {allowed.map((l) => (
          <Btn key={l.path} as={Link} to={l.path} $variant="outline">
            {l.icon} {l.label}
          </Btn>
        ))}
      </QuickRow>
    </Card>
  );
}

export default function BoshSahifa() {
  const { user } = useAuth();
  const can = usePermission();
  const { isStudent, isMentor } = useResidencyCapabilities();

  const seesInstituteWide = can('residencyReport:readAll');
  const seesOthers = !seesInstituteWide && can('resident:readAll');
  const isClinical = can('residentAttendance:create');

  const name = user.name.trim();
  const greeting = seesInstituteWide
    ? 'Boshqaruv paneli'
    : name
      ? `Xush kelibsiz, ${name}!`
      : 'Xush kelibsiz!';

  return (
    <div>
      <PageTitle>{greeting}</PageTitle>

      {seesInstituteWide && <AdminDashboard />}
      {seesOthers && <MentorDashboard isMentor={isMentor} isClinical={isClinical} />}
      {isStudent && <StudentDashboard />}
    </div>
  );
}

function AdminDashboard() {
  const magQ = useResidents({ program: 'magistratura', limit: 1 });
  const ordQ = useResidents({ program: 'ordinatura', limit: 1 });
  const appStatsQ = useApplicationStats();
  const logStatsQ = useDailyLogStats();

  const state = combineState([magQ, ordQ, appStatsQ, logStatsQ]);
  const retry = () => {
    void magQ.refetch();
    void ordQ.refetch();
    void appStatsQ.refetch();
    void logStatsQ.refetch();
  };

  const mag = magQ.data?.total ?? 0;
  const ord = ordQ.data?.total ?? 0;
  const appStats = appStatsQ.data;
  const logStats = logStatsQ.data;

  return (
    <>
      {state === 'ok' ? (
        <StatCards>
          <StatCard icon="👥" iconBg="#EAFAF1" number={mag + ord} label="Jami talabalar" />
          <StatCard icon="📄" iconBg="#FEF9E7" number={appStats?.pending ?? 0} label="Yangi arizalar" />
          <StatCard icon="✅" iconBg="#EAFAF1" number={appStats?.tasdiqlangan ?? 0} label="Tasdiqlangan arizalar" />
          <StatCard icon="📔" iconBg="#EBF5FB" number={logStats?.kutilmoqda ?? 0} label="Kundalik kutilmoqda" />
        </StatCards>
      ) : (
        <QueryNotice state={state} onRetry={retry} />
      )}

      <Grid>
        <Card>
          <SectionTitle>Dastur bo'yicha taqsimot</SectionTitle>
          {state === 'ok' ? (
            <>
              <DistRow>
                <Dot $color="#27AE60" />
                <DistName>Magistrantlar soni</DistName>
                <DistNum $color="#27AE60">{mag}</DistNum>
              </DistRow>
              <DistRow>
                <Dot $color="#E74C3C" />
                <DistName>Rezidentlar soni</DistName>
                <DistNum $color="#E74C3C">{ord}</DistNum>
              </DistRow>
            </>
          ) : (
            <QueryNotice state={state} onRetry={retry} compact />
          )}
        </Card>

        <QuickLinks items={[LINK.kontingent, LINK.arizalar, LINK.mutaxassisliklar]} />
      </Grid>
    </>
  );
}

function MentorDashboard({ isMentor, isClinical }: { isMentor: boolean; isClinical: boolean }) {
  const myResidentsQ = useMyResidents({}, true);
  const logStatsQ = useDailyLogStats();

  const state = combineState([myResidentsQ, logStatsQ]);
  const retry = () => {
    void myResidentsQ.refetch();
    void logStatsQ.refetch();
  };

  const myResidents = myResidentsQ.data ?? [];
  const logStats = logStatsQ.data;

  return (
    <>
      {state === 'ok' ? (
        <StatCards>
          <StatCard
            icon="🩺"
            iconBg="#FDEDEC"
            number={myResidents.length}
            label={
              isMentor ? (isClinical ? 'Rezidentlarim' : 'Magistrantlarim') : 'Biriktirilgan talabalar'
            }
          />
          <StatCard icon="📔" iconBg="#FEF9E7" number={logStats?.kutilmoqda ?? 0} label="Tekshirilmagan kundaliklar" />
        </StatCards>
      ) : (
        <QueryNotice state={state} onRetry={retry} />
      )}

      <Grid>
        <QuickLinks
          items={[LINK.davomat, LINK.kundalik, LINK.biriktirish, LINK.kalendarRejalar]}
        />
      </Grid>
    </>
  );
}

function PlanStatCards() {
  const actQ = activityPlanHooks.useStats();
  const disQ = dissertationPlanHooks.useStats();

  const state = combineState([actQ, disQ]);
  const retry = () => {
    void actQ.refetch();
    void disQ.refetch();
  };

  if (state !== 'ok') return <QueryNotice state={state} onRetry={retry} />;

  const act = actQ.data;
  const dis = disQ.data;
  return (
    <StatCards>
      <StatCard icon="📋" iconBg="#EAFAF1" number={act?.total ?? 0} label="Faoliyat rejalari" />
      <StatCard icon="📖" iconBg="#EBF5FB" number={dis?.total ?? 0} label="Dissertatsiya rejalari" />
      <StatCard
        icon="⏳"
        iconBg="#FEF9E7"
        number={(act?.yuborilgan ?? 0) + (dis?.yuborilgan ?? 0)}
        label="Tasdiq kutmoqda"
      />
      <StatCard
        icon="✅"
        iconBg="#EAFAF1"
        number={(act?.bajarilgan ?? 0) + (dis?.bajarilgan ?? 0)}
        label="Bajarilgan rejalar"
      />
    </StatCards>
  );
}

function AssignmentCard() {
  const { data: me } = useMyResident();
  if (!me) return null;

  const hasAny =
    me.supervisorName ||
    me.weeklyHours != null ||
    me.teachingLocation ||
    me.practiceLocation ||
    me.scheduleText;
  if (!hasAny) return null;

  const label = me.program === 'magistratura' ? 'Ilmiy rahbar' : 'Klinik ustoz';

  return (
    <Card style={{ marginBottom: 20 }}>
      <SectionTitle>Biriktirish</SectionTitle>
      <AssignGrid>
        <AssignItem>
          <AssignLabel>{label}</AssignLabel>
          <AssignValue>{me.supervisorName || '—'}</AssignValue>
        </AssignItem>
        <AssignItem>
          <AssignLabel>Haftalik dars soati</AssignLabel>
          <AssignValue>{me.weeklyHours != null ? `${me.weeklyHours} soat` : '—'}</AssignValue>
        </AssignItem>
        <AssignItem>
          <AssignLabel>Dars o‘tish joyi</AssignLabel>
          <AssignValue>{me.teachingLocation || '—'}</AssignValue>
        </AssignItem>
        <AssignItem>
          <AssignLabel>Amaliyot joyi</AssignLabel>
          <AssignValue>{me.practiceLocation || '—'}</AssignValue>
        </AssignItem>
        <AssignItem>
          <AssignLabel>Dars jadvali</AssignLabel>
          <AssignValue>{me.scheduleText || '—'}</AssignValue>
        </AssignItem>
      </AssignGrid>
    </Card>
  );
}

function StudentDashboard() {
  const can = usePermission();
  const logStatsQ = useDailyLogStats();
  const appStatsQ = useApplicationStats();

  const state = combineState([logStatsQ, appStatsQ]);
  const retry = () => {
    void logStatsQ.refetch();
    void appStatsQ.refetch();
  };

  const logStats = logStatsQ.data;
  const appStats = appStatsQ.data;
  const hasPlans = can('residencyActivityPlan:readAll');

  return (
    <>
      {hasPlans && <PlanStatCards />}

      <AssignmentCard />

      {state === 'ok' ? (
        <StatCards>
          <StatCard icon="📔" iconBg="#EBF5FB" number={logStats?.total ?? 0} label="Kundalik yozuvlari" />
          <StatCard icon="📄" iconBg="#FEF9E7" number={appStats?.pending ?? 0} label="Kutilayotgan arizalar" />
        </StatCards>
      ) : (
        <QueryNotice state={state} onRetry={retry} />
      )}

      <Grid>
        <QuickLinks
          items={[LINK.kundalik, LINK.arizalar, LINK.davomat, LINK.faoliyatRejasi, LINK.dissertatsiya]}
        />
      </Grid>
    </>
  );
}

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;
const Card = styled.div`
  background: ${({ theme }) => theme.colors.white};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.lg};
  box-shadow: ${({ theme }) => theme.shadow.sm};
  padding: 20px;
`;
const AssignGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px 20px;
`;
const AssignItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
`;
const AssignLabel = styled.span`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.textMuted};
`;
const AssignValue = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.text};
  word-break: break-word;
`;
const QuickRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;
const DistRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  &:last-child {
    margin-bottom: 0;
  }
`;
const Dot = styled.span<{ $color: string }>`
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;
const DistName = styled.div`
  flex: 1;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text};
`;
const DistNum = styled.div<{ $color: string }>`
  font-size: 18px;
  font-weight: 700;
  color: ${({ $color }) => $color};
`;
