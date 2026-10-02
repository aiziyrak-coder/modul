import { ReferenceManager } from '../../components/reference-manager';

export default function RegionsPage() {
  return (
    <ReferenceManager
      config={{
        name: 'regions',
        section: 'province',
        title: 'Viloyatlar',
        newButton: "Viloyat qo'shish",
        columnLabel: 'Viloyat nomi',
        withDistrictCount: true,
      }}
    />
  );
}
