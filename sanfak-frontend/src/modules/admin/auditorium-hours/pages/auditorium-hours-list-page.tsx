import { ReferenceListPage } from '../../lib/reference-crud/reference-list-page';
import { auditoriumHourConfig } from '../auditorium-hour.config';

export default function AuditoriumHoursListPage() {
  return <ReferenceListPage config={auditoriumHourConfig} />;
}
