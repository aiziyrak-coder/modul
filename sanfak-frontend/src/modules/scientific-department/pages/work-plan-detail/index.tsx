import PlanDetailView from '../../components/plan-detail-view';
import { workPlanApi } from '../../api/plan-api';

export default function WorkPlanDetailPage() {
  return (
    <PlanDetailView
      api={workPlanApi}
      prefix="workPlans"
      permSection="departmentWorkPlan"
      backTo="/scientific-department/work-plans"
    />
  );
}
