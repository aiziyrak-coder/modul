import PlanListView from '../components/plan/PlanListView';
import { activityPlanHooks } from '../api/plan-api';
import { ACTIVITY_KIND } from '../api/plan-types';

export default function FaoliyatRejasi() {
  return <PlanListView hooks={activityPlanHooks} kind={ACTIVITY_KIND} />;
}
