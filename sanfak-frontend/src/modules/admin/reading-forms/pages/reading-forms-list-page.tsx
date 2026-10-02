import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { readingFormConfig } from '../reading-form.config';

export default function ReadingFormsListPage() {
  return <ReferenceListPage config={readingFormConfig} />;
}
