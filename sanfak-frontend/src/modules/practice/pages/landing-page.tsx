import { Navigate } from 'react-router-dom';
import type { PracticeRole } from '../model/types';
import { usePracticeRole } from '../model/view-role';

const LANDING: Record<PracticeRole, string> = {
  amaliyot_bolimi: '/amaliyot/bazalar',
  rektor: '/amaliyot/shartnomalar',
  tibbiyot_birlashmasi_rahbari: '/amaliyot/shartnomalar',
  admin: '/amaliyot/sozlamalar/tashkilot-turlari',
};

export default function LandingPage() {
  const role = usePracticeRole();
  return <Navigate to={LANDING[role]} replace />;
}
