import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { positionConfig } from '../position.config';

export default function PositionsListPage() {
  return <ReferenceListPage config={positionConfig} />;
}
