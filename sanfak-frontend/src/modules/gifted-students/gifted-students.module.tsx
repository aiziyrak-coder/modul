import { lazy, type ComponentType } from 'react';
import { Navigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import {
  AuditOutlined,
  BarChartOutlined,
  ControlOutlined,
  FileTextOutlined,
  MessageOutlined,
  ReadOutlined,
  StarOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { defineModule } from '@/shared/lib/module';
import { theme } from './styles/theme';
import { GlobalStyles } from './styles/globalStyles';
import { currentSurface, menuForSurface, SURFACE_HOME } from './lib/menu-surface';
import SurfaceGuard from './components/common/SurfaceGuard';

function themed(loader: () => Promise<{ default: ComponentType }>): ComponentType {
  const Lazy = lazy(loader);
  return function Themed() {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        <SurfaceGuard>
          <Lazy />
        </SurfaceGuard>
      </ThemeProvider>
    );
  };
}

const Landing = () => <Navigate to={SURFACE_HOME[currentSurface() ?? 'student']} replace />;

const GS_READ = 'giftedStudent:read';
const GS_READALL = 'giftedStudent:readAll';
const ACHIEVEMENT = 'studentAchievement:readAll';
const ACHIEVEMENT_REVIEW = 'studentAchievement:approve';
const CRITERIA = 'evaluationCriteria:readAll';
const CRITERIA_MANAGE = 'evaluationCriteria:create';
const SCHOLARSHIP_READ = 'scholarshipApplication:read';
const SCHOLARSHIP = 'scholarshipApplication:readAll';
const GS_CREATE = 'giftedStudent:create';
const GS_UPDATE = 'giftedStudent:update';
const GS_DELETE = 'giftedStudent:delete';
const SCHOLARSHIP_MANAGE = 'scholarship:create';

const STUDENT_SURFACE = 'studentAchievement:create';

const JUDGE_SURFACE = 'scholarshipApplication:score';

const MENU_ITEMS = [
    { titleKey: 'giftedStudents.nav.studentActivities', icon: <FileTextOutlined />, path: '/gifted-students/student/activities', order: 1101, permission: ACHIEVEMENT },
    { titleKey: 'giftedStudents.nav.studentScholarships', icon: <ReadOutlined />, path: '/gifted-students/student/scholarships', order: 1102, permission: SCHOLARSHIP_READ },
    { titleKey: 'giftedStudents.nav.studentNomdor', icon: <StarOutlined />, path: '/gifted-students/student/scholarships/nomdor', order: 1103, permission: SCHOLARSHIP_READ, parent: '/gifted-students/student/scholarships' },
    { titleKey: 'giftedStudents.nav.studentRektor', icon: <ReadOutlined />, path: '/gifted-students/student/scholarships/rektor', order: 1104, permission: SCHOLARSHIP_READ, parent: '/gifted-students/student/scholarships' },
    { titleKey: 'giftedStudents.nav.studentAdvisor', icon: <MessageOutlined />, path: '/gifted-students/student/advisor', order: 1105, permission: STUDENT_SURFACE },
    { titleKey: 'giftedStudents.nav.studentProfile', icon: <UserOutlined />, path: '/gifted-students/student/profile', order: 1106, permission: STUDENT_SURFACE },

    { titleKey: 'giftedStudents.nav.departmentStudents', icon: <TeamOutlined />, path: '/gifted-students/department/students', order: 1201, permission: GS_READALL },
    { titleKey: 'giftedStudents.nav.departmentScholarships', icon: <ReadOutlined />, path: '/gifted-students/department/scholarships', order: 1202, permission: SCHOLARSHIP },
    { titleKey: 'giftedStudents.nav.departmentNomdor', icon: <StarOutlined />, path: '/gifted-students/department/scholarships/nomdor', order: 1203, permission: SCHOLARSHIP, parent: '/gifted-students/department/scholarships' },
    { titleKey: 'giftedStudents.nav.departmentRektor', icon: <ReadOutlined />, path: '/gifted-students/department/scholarships/rektor', order: 1204, permission: SCHOLARSHIP, parent: '/gifted-students/department/scholarships' },
    { titleKey: 'giftedStudents.nav.departmentReview', icon: <AuditOutlined />, path: '/gifted-students/department/review', order: 1205, permission: ACHIEVEMENT_REVIEW },
    { titleKey: 'giftedStudents.nav.departmentCriteria', icon: <ControlOutlined />, path: '/gifted-students/department/criteria', order: 1206, permission: CRITERIA_MANAGE },

    { titleKey: 'giftedStudents.nav.managementReports', icon: <BarChartOutlined />, path: '/gifted-students/management/reports', order: 1301, permission: GS_READALL },

    { titleKey: 'giftedStudents.nav.judgeScholarships', icon: <StarOutlined />, path: '/gifted-students/judge/scholarships', order: 1401, permission: JUDGE_SURFACE },

    { titleKey: 'giftedStudents.nav.advisorStudent', icon: <ReadOutlined />, path: '/gifted-students/advisor/student', order: 1501, permission: GS_READALL },
];

export default defineModule({
  name: 'gifted-students',
  menuGroup: { titleKey: 'menuGroup.giftedStudents', order: 70 },

  routes: [
    { index: true, element: Landing },

    { path: 'student/activities', permission: ACHIEVEMENT, element: themed(() => import('./pages/student/Activities')) },
    { path: 'student/scholarships', permission: SCHOLARSHIP_READ, element: themed(() => import('./pages/student/Scholarships')) },
    { path: 'student/scholarships/nomdor/:id', permission: SCHOLARSHIP_READ, element: themed(() => import('./pages/scholarships/NomdorDetail')) },
    { path: 'student/scholarships/rektor/:id', permission: SCHOLARSHIP_READ, element: themed(() => import('./pages/scholarships/RektorDetail')) },
    { path: 'student/scholarships/:type', permission: SCHOLARSHIP_READ, element: themed(() => import('./pages/scholarships/ScholarshipsByCategory')) },
    { path: 'student/advisor', permission: STUDENT_SURFACE, element: themed(() => import('./pages/student/Advisor')) },
    { path: 'student/profile', permission: STUDENT_SURFACE, element: themed(() => import('./pages/student/Profile')) },

    { path: 'department/students', permission: GS_READALL, element: themed(() => import('./pages/department/Students')) },
    { path: 'department/students/new', permission: GS_CREATE, element: themed(() => import('./pages/department/StudentForm')) },
    { path: 'department/students/edit/:id', permission: GS_CREATE, element: themed(() => import('./pages/department/StudentForm')) },
    { path: 'department/students/:id', permission: GS_READ, element: themed(() => import('./pages/department/StudentDetail')) },
    { path: 'department/scholarships', permission: SCHOLARSHIP, element: themed(() => import('./pages/department/Scholarships')) },
    { path: 'department/scholarships/nomdor/new', permission: SCHOLARSHIP_MANAGE, element: themed(() => import('./pages/scholarships/NomdorForm')) },
    { path: 'department/scholarships/nomdor/:id/edit', permission: SCHOLARSHIP_MANAGE, element: themed(() => import('./pages/scholarships/NomdorForm')) },
    { path: 'department/scholarships/nomdor/:id', permission: SCHOLARSHIP, element: themed(() => import('./pages/scholarships/NomdorDetail')) },
    { path: 'department/scholarships/rektor/new', permission: SCHOLARSHIP_MANAGE, element: themed(() => import('./pages/scholarships/RektorYonalishForm')) },
    { path: 'department/scholarships/rektor/:id/edit', permission: SCHOLARSHIP_MANAGE, element: themed(() => import('./pages/scholarships/RektorYonalishForm')) },
    { path: 'department/scholarships/rektor/:id', permission: SCHOLARSHIP, element: themed(() => import('./pages/scholarships/RektorDetail')) },
    { path: 'department/scholarships/:type', permission: SCHOLARSHIP, element: themed(() => import('./pages/scholarships/ScholarshipsByCategory')) },
    { path: 'department/review', permission: ACHIEVEMENT_REVIEW, element: themed(() => import('./pages/department/Review')) },
    { path: 'department/criteria', permission: CRITERIA_MANAGE, element: themed(() => import('./pages/department/Criteria')) },
    { path: 'department/profile', permission: GS_READALL, element: themed(() => import('./pages/department/Profile')) },

    { path: 'management/reports', permission: GS_READALL, element: themed(() => import('./pages/management/Reports')) },
    { path: 'management/students/:id/activities', permission: ACHIEVEMENT, element: themed(() => import('./pages/management/StudentActivities')) },
    { path: 'management/profile', permission: GS_READALL, element: themed(() => import('./pages/management/Profile')) },

    { path: 'judge/scholarships', permission: JUDGE_SURFACE, element: themed(() => import('./pages/judge/Scholarships')) },
    { path: 'judge/scholarships/:id', permission: SCHOLARSHIP, element: themed(() => import('./pages/judge/ScholarshipDetail')) },
    { path: 'judge/profile', permission: SCHOLARSHIP, element: themed(() => import('./pages/judge/Profile')) },

    { path: 'advisor/student', permission: GS_READALL, element: themed(() => import('./pages/advisor/StudentView')) },
  ],

  get menu() {
    return menuForSurface(MENU_ITEMS, currentSurface());
  },

  i18n: {
    uz: {
      'menuGroup.giftedStudents': 'Iqtidorli talabalar',
      'giftedStudents.nav.studentActivities': 'Faoliyat va hujjatlarim',
      'giftedStudents.nav.studentScholarships': 'Stipendiyalar',
      'giftedStudents.nav.studentNomdor': 'Nomdor stipendiyalar',
      'giftedStudents.nav.studentRektor': 'Rektor stipendiyasi',
      'giftedStudents.nav.studentAdvisor': 'Maslahatchi',
      'giftedStudents.nav.studentProfile': 'Profil',
      'giftedStudents.nav.departmentStudents': 'Talabalar',
      'giftedStudents.nav.departmentScholarships': 'Stipendiyalar',
      'giftedStudents.nav.departmentNomdor': 'Nomdor stipendiyalar',
      'giftedStudents.nav.departmentRektor': 'Rektor stipendiyasi',
      'giftedStudents.nav.departmentReview': 'Faoliyat va hujjatlar',
      'giftedStudents.nav.departmentCriteria': 'Baholash mezonlari',
      'giftedStudents.nav.managementReports': 'Hisobotlar',
      'giftedStudents.nav.judgeScholarships': 'Stipendiyani baholash',
      'giftedStudents.nav.advisorStudent': 'Iqtidorli talaba',
    },
    ru: {
      'menuGroup.giftedStudents': 'Одарённые студенты',
      'giftedStudents.nav.studentActivities': 'Моя деятельность и документы',
      'giftedStudents.nav.studentScholarships': 'Стипендии',
      'giftedStudents.nav.studentNomdor': 'Именные стипендии',
      'giftedStudents.nav.studentRektor': 'Ректорская стипендия',
      'giftedStudents.nav.studentAdvisor': 'Наставник',
      'giftedStudents.nav.studentProfile': 'Профиль',
      'giftedStudents.nav.departmentStudents': 'Студенты',
      'giftedStudents.nav.departmentScholarships': 'Стипендии',
      'giftedStudents.nav.departmentNomdor': 'Именные стипендии',
      'giftedStudents.nav.departmentRektor': 'Ректорская стипендия',
      'giftedStudents.nav.departmentReview': 'Деятельность и документы',
      'giftedStudents.nav.departmentCriteria': 'Критерии оценки',
      'giftedStudents.nav.managementReports': 'Отчёты',
      'giftedStudents.nav.judgeScholarships': 'Оценка стипендии',
      'giftedStudents.nav.advisorStudent': 'Одарённый студент',
    },
    en: {
      'menuGroup.giftedStudents': 'Gifted students',
      'giftedStudents.nav.studentActivities': 'My activity & documents',
      'giftedStudents.nav.studentScholarships': 'Scholarships',
      'giftedStudents.nav.studentNomdor': 'Named scholarships',
      'giftedStudents.nav.studentRektor': 'Rector scholarship',
      'giftedStudents.nav.studentAdvisor': 'Advisor',
      'giftedStudents.nav.studentProfile': 'Profile',
      'giftedStudents.nav.departmentStudents': 'Students',
      'giftedStudents.nav.departmentScholarships': 'Scholarships',
      'giftedStudents.nav.departmentNomdor': 'Named scholarships',
      'giftedStudents.nav.departmentRektor': 'Rector scholarship',
      'giftedStudents.nav.departmentReview': 'Activity & documents',
      'giftedStudents.nav.departmentCriteria': 'Evaluation criteria',
      'giftedStudents.nav.managementReports': 'Reports',
      'giftedStudents.nav.judgeScholarships': 'Scholarship evaluation',
      'giftedStudents.nav.advisorStudent': 'Gifted student',
    },
  },

  permissions: [
    { key: GS_READ, description: 'Gifted-students: read a student record (own / advisor / detail)' },
    { key: GS_READALL, description: 'Gifted-students: list all student records (department / management)' },
    { key: ACHIEVEMENT, description: 'Gifted-students: student achievements list & review' },
    { key: CRITERIA, description: 'Gifted-students: evaluation criteria' },
    { key: ACHIEVEMENT_REVIEW, description: 'Gifted: review (approve/reject) a student achievement — department only' },
    { key: CRITERIA_MANAGE, description: 'Gifted: create/manage evaluation criteria (department only)' },
    { key: SCHOLARSHIP_READ, description: 'Gifted-students: read scholarship applications (student)' },
    { key: SCHOLARSHIP, description: 'Gifted-students: list all scholarship applications (department / judge)' },
    { key: GS_CREATE, description: 'Gifted-students: create/edit a student record (department)' },
    { key: GS_UPDATE, description: 'Gifted-students: edit an existing student record (department)' },
    { key: GS_DELETE, description: 'Gifted-students: delete a student record (department)' },
    { key: SCHOLARSHIP_MANAGE, description: 'Gifted-students: create/edit scholarship definitions (department)' },
    { key: STUDENT_SURFACE, description: 'Gifted-students: student enters own achievements — marks the STUDENT surface' },
    { key: JUDGE_SURFACE, description: 'Gifted-students: judge scores applications — marks the JUDGE surface' },
  ],
});
