import PlanBoard from '../../components/plan-board';
import { annualReportApi } from '../../api/plan-api';

export default function AnnualReportsPage() {
  return (
    <PlanBoard
      api={annualReportApi}
      prefix="annualReports"
      permSection="annualReport"
      detailBase="/scientific-department/annual-reports"
    />
  );
}
