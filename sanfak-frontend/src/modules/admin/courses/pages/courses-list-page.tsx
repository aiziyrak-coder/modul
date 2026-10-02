import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { courseConfig } from '../course.config';

export default function CoursesListPage() {
  return <ReferenceListPage config={courseConfig} />;
}
