import PlanListView from '../components/plan/PlanListView';
import { dissertationPlanHooks } from '../api/plan-api';
import { DISSERTATION_KIND } from '../api/plan-types';

export default function Dissertatsiya() {
  return <PlanListView hooks={dissertationPlanHooks} kind={DISSERTATION_KIND} />;
}
