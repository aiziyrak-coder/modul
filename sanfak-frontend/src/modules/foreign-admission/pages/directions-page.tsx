import { LangCrudPage } from '../lib/lang-crud/lang-crud-page';
import { directionsConfig } from '../lib/lang-crud/configs';

export default function DirectionsPage() {
  return <LangCrudPage config={directionsConfig} />;
}
