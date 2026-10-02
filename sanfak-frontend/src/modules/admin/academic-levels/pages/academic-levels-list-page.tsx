import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { academicLevelConfig } from '../academic-level.config';

export default function AcademicLevelsListPage() {
  return <ReferenceListPage config={academicLevelConfig} />;
}
