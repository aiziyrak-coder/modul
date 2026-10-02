import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { languageConfig } from '../language.config';

export default function LanguagesListPage() {
  return <ReferenceListPage config={languageConfig} />;
}
