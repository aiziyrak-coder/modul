import PlanDetailView from '../components/plan/PlanDetailView';
import { activityPlanHooks } from '../api/plan-api';
import { ACTIVITY_KIND } from '../api/plan-types';

export default function FaoliyatRejasiDetail() {
  return <PlanDetailView hooks={activityPlanHooks} kind={ACTIVITY_KIND} />;
}
