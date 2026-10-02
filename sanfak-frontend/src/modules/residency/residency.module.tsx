import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate } from 'react-router-dom';
import { ThemeProvider, type DefaultTheme } from 'styled-components';
import {
  DashboardOutlined,
  TeamOutlined,
  ReadOutlined,
  CalendarOutlined,
  ProfileOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  ApartmentOutlined,
  SolutionOutlined,
  BookOutlined,
  AuditOutlined,
  ExperimentOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  ScheduleOutlined,
  NotificationOutlined,
  SoundOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  MessageOutlined,
  BarChartOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { defineModule } from '@/shared/lib/module';
import { useSessionStore } from '@/app/session';
import { applyExtraGates } from './lib/menu-gate';
import { theme } from './styles/theme';
import { GlobalStyles } from './styles/globalStyles';

function themed(loader: () => Promise<{ default: ComponentType }>): ComponentType {
  const Lazy = lazy(loader);
  return function Themed() {
    return (
      <ThemeProvider theme={theme as unknown as DefaultTheme}>
        <GlobalStyles />
        <div className="residency-root">
          <Suspense fallback={<div style={{ padding: 24 }}>Yuklanmoqda…</div>}>
            <Lazy />
          </Suspense>
        </div>
      </ThemeProvider>
    );
  };
}

const Landing = () => <Navigate to="/residency/bosh-sahifa" replace />;

const RESIDENT_READ = 'resident:read';
const RESIDENT_READALL = 'resident:readAll';
const RESIDENT_CREATE = 'resident:create';
const RESIDENT_UPDATE = 'resident:update';
const RESIDENT_CHANGE_STATUS = 'resident:changeStatus';
const SPECIALTY = 'residencySpecialty:readAll';
const APPLICATION = 'residentApplication:readAll';
const APPLICATION_CREATE = 'residentApplication:create';
const APPLICATION_APPROVE = 'residentApplication:approve';
const ATTENDANCE = 'residentAttendance:readAll';
const SETTINGS = ATTENDANCE;
const SETTINGS_EDIT = 'residencyLesson:update';
const SAMS_STATUS = SETTINGS_EDIT;

const ATTENDANCE_CREATE = 'residentAttendance:create';
const ATTENDANCE_UPDATE = 'residentAttendance:update';
const ATTENDANCE_APPROVE = 'residentAttendance:approve';
const DAILYLOG = 'residentDailyLog:readAll';
const DAILYLOG_APPROVE = 'residentDailyLog:approve';
const ACTIVITY_PLAN = 'residencyActivityPlan:readAll';
const ACTIVITY_PLAN_CREATE = 'residencyActivityPlan:create';
const ACTIVITY_PLAN_APPROVE = 'residencyActivityPlan:approve';
const ACTIVITY_PLAN_UPDATE = 'residencyActivityPlan:update';
const ACTIVITY_PLAN_DELETE = 'residencyActivityPlan:delete';
const DISSERTATION_PLAN = 'residencyDissertationPlan:readAll';
const DISSERTATION_PLAN_CREATE = 'residencyDissertationPlan:create';
const DISSERTATION_PLAN_UPDATE = 'residencyDissertationPlan:update';
const DISSERTATION_PLAN_DELETE = 'residencyDissertationPlan:delete';
const DISSERTATION_PLAN_APPROVE = 'residencyDissertationPlan:approve';
const SKILL = 'residencySkill:readAll';
const SKILL_CREATE = 'residencySkill:create';
const SKILL_UPDATE = 'residencySkill:update';
const SKILL_DELETE = 'residencySkill:delete';
const THEORY_TOPIC = 'residencyTheoryTopic:readAll';
const THEORY_TOPIC_CREATE = 'residencyTheoryTopic:create';
const THEORY_TOPIC_UPDATE = 'residencyTheoryTopic:update';
const THEORY_TOPIC_DELETE = 'residencyTheoryTopic:delete';
const SPECIALTY_CREATE = 'residencySpecialty:create';
const SPECIALTY_UPDATE = 'residencySpecialty:update';
const SPECIALTY_DELETE = 'residencySpecialty:delete';
const ATTESTATION = 'residencyAttestation:readAll';
const ATTESTATION_CREATE = 'residencyAttestation:create';
const ATTESTATION_UPDATE = 'residencyAttestation:update';
const ATTESTATION_DELETE = 'residencyAttestation:delete';
const ASSESSMENT = 'residentAssessment:readAll';
const ASSESSMENT_SCORE = 'residentAssessment:score';
const ASSESSMENT_DELETE = 'residentAssessment:delete';
const OPEN_LESSON = 'residencyOpenLesson:create';
const CURRICULUM = 'residencyCurriculum:readAll';
const CURRICULUM_CREATE = 'residencyCurriculum:create';
const CURRICULUM_UPDATE = 'residencyCurriculum:update';
const LESSON = 'residencyLesson:readAll';
const LESSON_CREATE = 'residencyLesson:create';
const NOTICE = 'residencyNotice:readAll';
const NOTICE_CREATE = 'residencyNotice:create';
const NOTICE_UPDATE = 'residencyNotice:update';
const NOTICE_DELETE = 'residencyNotice:delete';
const NOTICE_APPROVE = 'residencyNotice:approve';
const ANNOUNCEMENT = 'residencyAnnouncement:readAll';
const ANNOUNCEMENT_CREATE = 'residencyAnnouncement:create';
const RESOURCE = 'residentResource:readAll';
const RESOURCE_CREATE = 'residentResource:create';
const CHAT = 'chat:readAll';
const REPORT = 'residencyReport:readAll';
const RESIDENCY_ANY = [
  RESIDENT_READ, RESIDENT_READALL, SPECIALTY, APPLICATION, ATTENDANCE, DAILYLOG,
  ACTIVITY_PLAN, DISSERTATION_PLAN, SKILL, ATTESTATION, CURRICULUM, LESSON,
  NOTICE, ANNOUNCEMENT, RESOURCE, REPORT,
];

const NotificationsRedirect = () => <Navigate to="/bildirishnomalar" replace />;

const MENU_ITEMS = [
  { titleKey: 'residency.nav.boshSahifa', icon: <DashboardOutlined />, path: '/residency/bosh-sahifa', order: 4500, permission: RESIDENCY_ANY },
  { titleKey: 'residency.nav.kontingent', icon: <TeamOutlined />, path: '/residency/kontingent', order: 4501, permission: RESIDENT_READALL },
  { titleKey: 'residency.nav.biriktirish', icon: <ApartmentOutlined />, path: '/residency/biriktirish', order: 4502, permission: RESIDENT_READALL },
  { titleKey: 'residency.nav.mutaxassisliklar', icon: <ReadOutlined />, path: '/residency/mutaxassisliklar', order: 4503, permission: SPECIALTY },
  { titleKey: 'residency.nav.davomat', icon: <CalendarOutlined />, path: '/residency/davomat', order: 4504, permission: ATTENDANCE },
  { titleKey: 'residency.nav.samsHolati', icon: <ApiOutlined />, path: '/residency/sams-holati', order: 4504, permission: SAMS_STATUS },
  { titleKey: 'residency.nav.kundalik', icon: <ProfileOutlined />, path: '/residency/kundalik', order: 4505, permission: DAILYLOG },
  { titleKey: 'residency.nav.arizalar', icon: <FileDoneOutlined />, path: '/residency/arizalar', order: 4506, permission: APPLICATION },
  { titleKey: 'residency.nav.chetlatishBuyruqlari', icon: <FileProtectOutlined />, path: '/residency/chetlatish-buyruqlari', order: 4506, permission: RESIDENT_CHANGE_STATUS },
  { titleKey: 'residency.nav.faoliyatRejasi', icon: <SolutionOutlined />, path: '/residency/faoliyat-rejasi', order: 4507, permission: ACTIVITY_PLAN },
  { titleKey: 'residency.nav.dissertatsiya', icon: <BookOutlined />, path: '/residency/dissertatsiya', order: 4508, permission: DISSERTATION_PLAN },
  { titleKey: 'residency.nav.kalendarRejalar', icon: <AuditOutlined />, path: '/residency/kalendar-ish-rejalar', order: 4509, permission: ACTIVITY_PLAN },
  { titleKey: 'residency.nav.konikmalar', icon: <ExperimentOutlined />, path: '/residency/konikmalar', order: 4511, permission: SKILL },
  { titleKey: 'residency.nav.baholash', icon: <SafetyCertificateOutlined />, path: '/residency/baholash', order: 4511, permission: ASSESSMENT },
  { titleKey: 'residency.nav.sinovlar', icon: <FileTextOutlined />, path: '/residency/sinovlar', order: 4512, permission: ASSESSMENT },
  { titleKey: 'residency.nav.attestatsiyalar', icon: <SafetyCertificateOutlined />, path: '/residency/attestatsiyalar', order: 4512, permission: ATTESTATION },
  { titleKey: 'residency.nav.oquvReja', icon: <FileTextOutlined />, path: '/residency/oquv-reja', order: 4513, permission: CURRICULUM },
  { titleKey: 'residency.nav.umumiyDarslar', icon: <ScheduleOutlined />, path: '/residency/umumiy-darslar', order: 4514, permission: LESSON },
  { titleKey: 'residency.nav.bildirgilar', icon: <NotificationOutlined />, path: '/residency/bildirgilar', order: 4515, permission: NOTICE },
  { titleKey: 'residency.nav.elonlar', icon: <SoundOutlined />, path: '/residency/elonlar', order: 4516, permission: ANNOUNCEMENT },
  { titleKey: 'residency.nav.manbalar', icon: <FolderOpenOutlined />, path: '/residency/manbalar', order: 4517, permission: RESOURCE },
  { titleKey: 'residency.nav.sozlamalar', icon: <SettingOutlined />, path: '/residency/sozlamalar', order: 4518, permission: SETTINGS },
  { titleKey: 'residency.nav.chat', icon: <MessageOutlined />, path: '/residency/chat', order: 4518, permission: RESIDENCY_ANY },
  { titleKey: 'residency.nav.hisobotlar', icon: <BarChartOutlined />, path: '/residency/hisobotlar', order: 4519, permission: REPORT },
];

export default defineModule({
  name: 'residency',
  menuGroup: { titleKey: 'menuGroup.residency', order: 45 },

  routes: [
    { index: true, element: Landing },
    { path: 'bosh-sahifa', element: themed(() => import('./pages/BoshSahifa')) },

    { path: 'kontingent', permission: RESIDENT_READALL, element: themed(() => import('./pages/Kontingent')) },
    { path: 'kontingent/yangi', permission: RESIDENT_CREATE, element: themed(() => import('./pages/KontingentForm')) },
    { path: 'kontingent/tahrir/:id', permission: RESIDENT_UPDATE, element: themed(() => import('./pages/KontingentForm')) },
    { path: 'biriktirish', permission: RESIDENT_READALL, element: themed(() => import('./pages/Biriktirish')) },

    { path: 'mutaxassisliklar', permission: SPECIALTY, element: themed(() => import('./pages/Mutaxassisliklar')) },

    { path: 'davomat', permission: ATTENDANCE, element: themed(() => import('./pages/Davomat')) },
    { path: 'jurnal/:residentId', permission: ATTENDANCE, element: themed(() => import('./pages/JurnalDetail')) },
    { path: 'sams-holati', permission: SAMS_STATUS, element: themed(() => import('./pages/SamsHolati')) },

    { path: 'davomat/mashgulot/:id', permission: ATTENDANCE_CREATE, element: themed(() => import('./pages/MashgulotDetail')) },
    { path: 'davomat/mashgulot', element: themed(() => import('./pages/Mashgulotlar')) },
    { path: 'mashgulotlar', element: themed(() => import('./pages/Mashgulotlar')) },
    { path: 'mashgulotlar/:id', element: themed(() => import('./pages/Mashgulotlar')) },

    { path: 'kundalik', permission: DAILYLOG, element: themed(() => import('./pages/Kundalik')) },
    { path: 'kundalik/:residentId', permission: DAILYLOG, element: themed(() => import('./pages/KundalikDetail')) },

    { path: 'arizalar', permission: APPLICATION, element: themed(() => import('./pages/Arizalar')) },

    { path: 'chetlatish-buyruqlari', permission: RESIDENT_CHANGE_STATUS, element: themed(() => import('./pages/ChetlatishBuyruqlari')) },
    { path: 'chetlatish-buyruqlari/:id', permission: RESIDENT_CHANGE_STATUS, element: themed(() => import('./pages/ChetlatishBuyrugiDetail')) },

    { path: 'faoliyat-rejasi', permission: ACTIVITY_PLAN, element: themed(() => import('./pages/FaoliyatRejasi')) },
    { path: 'faoliyat-rejasi/:id', permission: ACTIVITY_PLAN, element: themed(() => import('./pages/FaoliyatRejasiDetail')) },
    { path: 'dissertatsiya', permission: DISSERTATION_PLAN, element: themed(() => import('./pages/Dissertatsiya')) },
    { path: 'dissertatsiya/:id', permission: DISSERTATION_PLAN, element: themed(() => import('./pages/DissertatsiyaDetail')) },
    { path: 'kalendar-ish-rejalar', permission: ACTIVITY_PLAN, element: themed(() => import('./pages/KalendarIshRejalar')) },
    { path: 'bildirishnomalar', element: NotificationsRedirect },

    { path: 'konikmalar', permission: SKILL, element: themed(() => import('./pages/Konikmalar')) },
    { path: 'baholash', permission: ASSESSMENT, element: themed(() => import('./pages/Baholash')) },
    { path: 'sinovlar', permission: ASSESSMENT, element: themed(() => import('./pages/Sinovlar')) },
    { path: 'sinovlar/:id', permission: ASSESSMENT, element: themed(() => import('./pages/SinovDetail')) },
    { path: 'attestatsiyalar', permission: ATTESTATION, element: themed(() => import('./pages/Attestatsiyalar')) },
    { path: 'attestatsiyalar/:id', permission: ATTESTATION, element: themed(() => import('./pages/AttestatsiyaDetail')) },

    { path: 'oquv-reja', permission: CURRICULUM, element: themed(() => import('./pages/OquvReja')) },
    { path: 'oquv-reja/:id', permission: CURRICULUM, element: themed(() => import('./pages/OquvRejaDetail')) },
    { path: 'umumiy-darslar', permission: LESSON, element: themed(() => import('./pages/UmumiyDarslar')) },

    { path: 'sozlamalar', permission: SETTINGS, element: themed(() => import('./pages/Sozlamalar')) },

    { path: 'bildirgilar', permission: NOTICE, element: themed(() => import('./pages/Bildirgilar')) },
    { path: 'elonlar', permission: ANNOUNCEMENT, element: themed(() => import('./pages/Elonlar')) },
    { path: 'manbalar', permission: RESOURCE, element: themed(() => import('./pages/Manbalar')) },
    { path: 'chat', permission: CHAT, element: themed(() => import('./pages/Chat')) },

    { path: 'hisobotlar', permission: REPORT, element: themed(() => import('./pages/Hisobotlar')) },
  ],

  get menu() {
    return applyExtraGates(MENU_ITEMS, useSessionStore.getState().permissions);
  },

  i18n: {
    uz: {
      'menuGroup.residency': 'Magistratura va ordinatura',
      'residency.nav.boshSahifa': 'Bosh sahifa',
      'residency.nav.kontingent': 'Kontingent',
      'residency.nav.biriktirish': 'Biriktirish',
      'residency.nav.mutaxassisliklar': 'Mutaxassisliklar',
      'residency.nav.davomat': 'Jurnal',
      'residency.nav.samsHolati': 'SAMS holati',
      'residency.nav.kundalik': 'Kundalik',
      'residency.nav.arizalar': 'Arizalar',
      'residency.nav.chetlatishBuyruqlari': 'Chetlatish buyruqlari',
      'residency.nav.faoliyatRejasi': 'Faoliyat rejasi',
      'residency.nav.dissertatsiya': 'Dissertatsiya',
      'residency.nav.kalendarRejalar': 'Kalendar ish rejalar',
      'residency.nav.bildirishnomalar': 'Bildirishnomalar',
      'residency.nav.konikmalar': 'Ko‘nikmalar',
      'residency.nav.baholash': 'Baholash',
      'residency.nav.sinovlar': 'Sinov testlari',
      'residency.nav.attestatsiyalar': 'Attestatsiyalar',
      'residency.nav.oquvReja': 'O‘quv reja',
      'residency.nav.umumiyDarslar': 'Umumiy darslar',
      'residency.nav.bildirgilar': 'Bildirgilar',
      'residency.nav.elonlar': 'E’lonlar',
      'residency.nav.manbalar': 'Manbalar',
      'residency.nav.sozlamalar': 'Sozlamalar',
      'residency.nav.chat': 'Chat',
      'residency.nav.hisobotlar': 'Hisobotlar',
    },
    ru: {
      'menuGroup.residency': 'Магистратура и ординатура',
      'residency.nav.boshSahifa': 'Главная',
      'residency.nav.kontingent': 'Контингент',
      'residency.nav.biriktirish': 'Прикрепление',
      'residency.nav.mutaxassisliklar': 'Специальности',
      'residency.nav.davomat': 'Журнал',
      'residency.nav.samsHolati': 'Статус SAMS',
      'residency.nav.kundalik': 'Дневник',
      'residency.nav.arizalar': 'Заявления',
      'residency.nav.chetlatishBuyruqlari': 'Приказы об отчислении',
      'residency.nav.faoliyatRejasi': 'План деятельности',
      'residency.nav.dissertatsiya': 'Диссертация',
      'residency.nav.kalendarRejalar': 'Календарные планы',
      'residency.nav.bildirishnomalar': 'Уведомления',
      'residency.nav.konikmalar': 'Навыки',
      'residency.nav.baholash': 'Оценивание',
      'residency.nav.sinovlar': 'Пробные тесты',
      'residency.nav.attestatsiyalar': 'Аттестации',
      'residency.nav.oquvReja': 'Учебный план',
      'residency.nav.umumiyDarslar': 'Общие занятия',
      'residency.nav.bildirgilar': 'Уведомления',
      'residency.nav.elonlar': 'Объявления',
      'residency.nav.manbalar': 'Ресурсы',
      'residency.nav.sozlamalar': 'Настройки',
      'residency.nav.chat': 'Чат',
      'residency.nav.hisobotlar': 'Отчёты',
    },
    en: {
      'menuGroup.residency': 'Master’s & residency',
      'residency.nav.boshSahifa': 'Dashboard',
      'residency.nav.kontingent': 'Contingent',
      'residency.nav.biriktirish': 'Assignment',
      'residency.nav.mutaxassisliklar': 'Specialties',
      'residency.nav.davomat': 'Journal',
      'residency.nav.samsHolati': 'SAMS status',
      'residency.nav.kundalik': 'Logbook',
      'residency.nav.arizalar': 'Applications',
      'residency.nav.chetlatishBuyruqlari': 'Expulsion orders',
      'residency.nav.faoliyatRejasi': 'Activity plan',
      'residency.nav.dissertatsiya': 'Dissertation',
      'residency.nav.kalendarRejalar': 'Calendar plans',
      'residency.nav.bildirishnomalar': 'Notifications',
      'residency.nav.konikmalar': 'Skills',
      'residency.nav.baholash': 'Assessment',
      'residency.nav.sinovlar': 'Trial tests',
      'residency.nav.attestatsiyalar': 'Attestations',
      'residency.nav.oquvReja': 'Curriculum',
      'residency.nav.umumiyDarslar': 'General lessons',
      'residency.nav.bildirgilar': 'Notices',
      'residency.nav.elonlar': 'Announcements',
      'residency.nav.manbalar': 'Resources',
      'residency.nav.sozlamalar': 'Settings',
      'residency.nav.chat': 'Chat',
      'residency.nav.hisobotlar': 'Reports',
    },
  },

  permissions: [
    { key: RESIDENT_READ, description: 'Residency: read a resident record (own / detail)' },
    { key: RESIDENT_READALL, description: 'Residency: list residents (contingent / assignment)' },
    { key: RESIDENT_CREATE, description: 'Residency: onboard a resident (contingent + account, §14)' },
    { key: RESIDENT_UPDATE, description: 'Residency: edit a resident record / assign a supervisor' },
    { key: RESIDENT_CHANGE_STATUS, description: 'Residency: expulsion orders — list, draft PDF, scan, sign/reject (office; backend also checks the role)' },
    { key: SPECIALTY, description: 'Residency: specialties catalog' },
    { key: SPECIALTY_CREATE, description: 'Residency: add a specialty (department only)' },
    { key: SPECIALTY_UPDATE, description: 'Residency: edit a specialty (department only)' },
    { key: SPECIALTY_DELETE, description: 'Residency: delete a specialty (department only)' },
    { key: ATTENDANCE, description: 'Residency: attendance journal' },
    { key: ATTENDANCE_CREATE, description: 'Residency: announce a lesson session (clinical supervisor / department)' },
    { key: ATTENDANCE_UPDATE, description: 'Residency: grade a lesson session (100-point score, TZ:540)' },
    { key: ATTENDANCE_APPROVE, description: 'Residency: excuse one absent lesson (department)' },
    { key: ASSESSMENT, description: 'Residency: 100-point assessment (TZ 4.5.6)' },
    { key: ASSESSMENT_SCORE, description: 'Residency: grade an assessment (POST /assessments/grade)' },
    { key: ASSESSMENT_DELETE, description: 'Residency: delete an assessment (department only)' },
    { key: DAILYLOG, description: 'Residency: clinical logbook' },
    { key: DAILYLOG_APPROVE, description: 'Residency: approve/return a logbook entry' },
    { key: APPLICATION, description: 'Residency: resident applications' },
    { key: APPLICATION_CREATE, description: 'Residency: submit a resident application' },
    { key: APPLICATION_APPROVE, description: 'Residency: approve/reject a resident application' },
    { key: ACTIVITY_PLAN, description: 'Residency: activity (calendar) plan' },
    { key: ACTIVITY_PLAN_CREATE, description: 'Residency: create/edit an activity plan (magistrant)' },
    { key: ACTIVITY_PLAN_APPROVE, description: 'Residency: approve/reject an activity plan (chain signer)' },
    { key: ACTIVITY_PLAN_UPDATE, description: 'Residency: edit an activity plan / upload proof' },
    { key: ACTIVITY_PLAN_DELETE, description: 'Residency: delete an activity plan' },
    { key: DISSERTATION_PLAN, description: 'Residency: dissertation (calendar) plan' },
    { key: DISSERTATION_PLAN_CREATE, description: 'Residency: create a dissertation plan (magistrant)' },
    { key: DISSERTATION_PLAN_UPDATE, description: 'Residency: edit a dissertation plan / upload proof' },
    { key: DISSERTATION_PLAN_DELETE, description: 'Residency: delete a dissertation plan' },
    { key: DISSERTATION_PLAN_APPROVE, description: 'Residency: approve/reject a dissertation plan' },
    { key: SKILL, description: 'Residency: clinical skills catalog & progress' },
    { key: SKILL_CREATE, description: 'Residency: add a clinical skill (department only)' },
    { key: SKILL_UPDATE, description: 'Residency: edit a clinical skill (department only)' },
    { key: SKILL_DELETE, description: 'Residency: delete a clinical skill (department only)' },
    { key: THEORY_TOPIC, description: 'Residency: theory & general-knowledge topics' },
    { key: THEORY_TOPIC_CREATE, description: 'Residency: add a theory topic (department only)' },
    { key: THEORY_TOPIC_UPDATE, description: 'Residency: edit a theory topic / toggle its status' },
    { key: THEORY_TOPIC_DELETE, description: 'Residency: delete a theory topic (department only)' },
    { key: ATTESTATION, description: 'Residency: attestations & per-student results' },
    { key: ATTESTATION_CREATE, description: 'Residency: create an attestation event' },
    { key: ATTESTATION_UPDATE, description: 'Residency: edit a result score / inclusion' },
    { key: ATTESTATION_DELETE, description: 'Residency: delete an attestation or a result row' },
    { key: OPEN_LESSON, description: 'Residency: assign open lesson / lesson observation (TZ 4.5.7)' },
    { key: CURRICULUM, description: 'Residency: curriculum documents (process & plan files)' },
    { key: CURRICULUM_CREATE, description: 'Residency: upload a curriculum document' },
    { key: CURRICULUM_UPDATE, description: 'Residency: edit a curriculum document' },
    { key: LESSON, description: 'Residency: general lessons schedule' },
    { key: LESSON_CREATE, description: 'Residency: create a general lesson' },
    { key: SETTINGS_EDIT, description: 'Residency: edit module settings (work day window, absence threshold) + SAMS status screen and outage windows (office)' },
    { key: NOTICE, description: 'Residency: notices from supervisors + department decision' },
    { key: NOTICE_CREATE, description: 'Residency: send a notice (supervisor)' },
    { key: NOTICE_UPDATE, description: 'Residency: edit own notice while still `yangi`' },
    { key: NOTICE_DELETE, description: 'Residency: delete own notice while still `yangi`' },
    { key: NOTICE_APPROVE, description: 'Residency: decide on a notice (department)' },
    { key: ANNOUNCEMENT, description: 'Residency: announcements by audience' },
    { key: ANNOUNCEMENT_CREATE, description: 'Residency: publish an announcement' },
    { key: RESOURCE, description: 'Residency: resource library' },
    { key: RESOURCE_CREATE, description: 'Residency: upload a resource' },
    { key: CHAT, description: 'Platform chat (system/chat) — reused by residency' },
    { key: REPORT, description: 'Residency: aggregated reports & charts (read-only)' },
  ],
});
