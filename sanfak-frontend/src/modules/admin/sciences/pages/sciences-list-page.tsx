import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { scienceConfig } from '../science.config';

export default function SciencesListPage() {
  return <ReferenceListPage config={scienceConfig} />;
}
