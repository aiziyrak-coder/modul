import PlanDetailView from '../../components/plan-detail-view';
import { annualReportApi } from '../../api/plan-api';

export default function AnnualReportDetailPage() {
  return (
    <PlanDetailView
      api={annualReportApi}
      prefix="annualReports"
      permSection="annualReport"
      backTo="/scientific-department/annual-reports"
    />
  );
}
