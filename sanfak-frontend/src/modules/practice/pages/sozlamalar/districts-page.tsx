import { ReferenceManager } from '../../components/reference-manager';

export default function DistrictsPage() {
  return (
    <ReferenceManager
      config={{
        name: 'districts',
        section: 'region',
        title: 'Shahar / Tumanlar',
        newButton: "Tuman qo'shish",
        columnLabel: 'Shahar / Tuman nomi',
        withRegion: true,
      }}
    />
  );
}
