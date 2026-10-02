import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { educationActivityTypeConfig } from '../education-activity-type.config';

export default function EducationActivityTypesListPage() {
  return <ReferenceListPage config={educationActivityTypeConfig} />;
}
