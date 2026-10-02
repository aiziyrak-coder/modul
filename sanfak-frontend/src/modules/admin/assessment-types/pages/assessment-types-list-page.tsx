import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { assessmentTypeConfig } from '../assessment-type.config';

export default function AssessmentTypesListPage() {
  return <ReferenceListPage config={assessmentTypeConfig} />;
}
