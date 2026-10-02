import PlanBoard from '../../components/plan-board';
import { workPlanApi } from '../../api/plan-api';

export default function WorkPlansPage() {
  return (
    <PlanBoard
      api={workPlanApi}
      prefix="workPlans"
      permSection="departmentWorkPlan"
      detailBase="/scientific-department/work-plans"
    />
  );
}
