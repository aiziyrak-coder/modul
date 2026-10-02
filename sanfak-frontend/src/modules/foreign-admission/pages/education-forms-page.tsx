import { LangCrudPage } from '../lib/lang-crud/lang-crud-page';
import { educationFormsConfig } from '../lib/lang-crud/configs';

export default function EducationFormsPage() {
  return <LangCrudPage config={educationFormsConfig} />;
}
