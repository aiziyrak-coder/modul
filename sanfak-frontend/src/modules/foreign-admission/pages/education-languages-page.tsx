import { LangCrudPage } from '../lib/lang-crud/lang-crud-page';
import { educationLanguagesConfig } from '../lib/lang-crud/configs';

export default function EducationLanguagesPage() {
  return <LangCrudPage config={educationLanguagesConfig} />;
}
