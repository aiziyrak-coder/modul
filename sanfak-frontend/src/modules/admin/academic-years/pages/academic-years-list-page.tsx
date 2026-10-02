import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { academicYearConfig } from '../academic-year.config';

export default function AcademicYearsListPage() {
  return <ReferenceListPage config={academicYearConfig} />;
}
