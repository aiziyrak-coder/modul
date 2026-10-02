import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { scienceBranchConfig } from '../science-branch.config';

export default function ScienceBranchesListPage() {
  return <ReferenceListPage config={scienceBranchConfig} />;
}
