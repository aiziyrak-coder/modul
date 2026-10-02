import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { divisionConfig } from '../division.config';

export default function DivisionsListPage() {
  return <ReferenceListPage config={divisionConfig} />;
}
