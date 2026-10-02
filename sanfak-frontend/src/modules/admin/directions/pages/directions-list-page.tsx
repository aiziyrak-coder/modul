import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { directionConfig } from '../direction.config';

export default function DirectionsListPage() {
  return <ReferenceListPage config={directionConfig} />;
}
