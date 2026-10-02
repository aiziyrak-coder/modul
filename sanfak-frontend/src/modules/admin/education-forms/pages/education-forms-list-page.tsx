import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { educationFormConfig } from '../education-form.config';

export default function EducationFormsListPage() {
  return <ReferenceListPage config={educationFormConfig} />;
}
