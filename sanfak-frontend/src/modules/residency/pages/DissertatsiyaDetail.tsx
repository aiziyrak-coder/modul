import PlanDetailView from '../components/plan/PlanDetailView';
import { dissertationPlanHooks } from '../api/plan-api';
import { DISSERTATION_KIND } from '../api/plan-types';

export default function DissertatsiyaDetail() {
  return <PlanDetailView hooks={dissertationPlanHooks} kind={DISSERTATION_KIND} />;
}
