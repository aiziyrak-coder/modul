import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { facultyConfig } from '../faculty.config';

export default function FacultiesListPage() {
  return <ReferenceListPage config={facultyConfig} />;
}
