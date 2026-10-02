import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { academicTitleConfig } from '../academic-title.config';

export default function AcademicTitlesListPage() {
  return <ReferenceListPage config={academicTitleConfig} />;
}
