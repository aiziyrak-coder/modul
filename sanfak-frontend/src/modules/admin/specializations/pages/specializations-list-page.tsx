import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { specializationConfig } from '../specialization.config';

export default function SpecializationsListPage() {
  return <ReferenceListPage config={specializationConfig} />;
}
