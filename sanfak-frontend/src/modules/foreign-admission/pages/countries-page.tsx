import { LangCrudPage } from '../lib/lang-crud/lang-crud-page';
import { countriesConfig } from '../lib/lang-crud/configs';

export default function CountriesPage() {
  return <LangCrudPage config={countriesConfig} />;
}
