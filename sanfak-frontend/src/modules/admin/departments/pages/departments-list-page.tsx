import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { departmentConfig } from '../department.config';

export default function DepartmentsListPage() {
  return <ReferenceListPage config={departmentConfig} />;
}
