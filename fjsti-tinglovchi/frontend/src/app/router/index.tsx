import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { AppLayout } from '@/widgets/app-layout';
import { loadProfile, useSessionStore } from '@/app/session';
import { ChatWidget } from '@/qual/components/chat-widget';
import LoginPage from '@/pages/login';

const EnrollmentPage = lazy(() => import('@/qual/pages/student/enrollment'));
const LearningPage = lazy(() => import('@/qual/pages/student/learning'));
const ResourcesPage = lazy(() => import('@/qual/pages/student/resources'));
const PaymentPage = lazy(() => import('@/qual/pages/student/payment'));
const ExitTestPage = lazy(() => import('@/qual/pages/student/exit-test'));
const CertificatePage = lazy(() => import('@/qual/pages/student/certificate'));
const SurveyPage = lazy(() => import('@/qual/pages/student/survey'));
const ProfilePage = lazy(() => import('@/qual/pages/student/profile'));

const Fallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
    <Spin />
  </div>
);

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useSessionStore((s) => s.status);
  const location = useLocation();

  if (status === 'loading') return <Fallback />;
  if (status === 'anonymous') return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export function AppRouter() {
  const status = useSessionStore((s) => s.status);

  useEffect(() => {
    if (status === 'loading') void loadProfile();
  }, [status]);

  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <AppLayout />
              <ChatWidget />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/enrollment" replace />} />
          <Route path="/enrollment" element={<EnrollmentPage />} />
          <Route path="/learning" element={<LearningPage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/exit-test" element={<ExitTestPage />} />
          <Route path="/certificate" element={<CertificatePage />} />
          <Route path="/survey/:courseId" element={<SurveyPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/enrollment" replace />} />
      </Routes>
    </Suspense>
  );
}
