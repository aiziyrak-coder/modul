import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { studyPeriodConfig } from '../study-period.config';

export default function StudyPeriodsListPage() {
  return <ReferenceListPage config={studyPeriodConfig} />;
}
