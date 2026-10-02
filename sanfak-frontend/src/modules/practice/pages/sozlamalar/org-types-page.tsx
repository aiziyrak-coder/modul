import { ReferenceManager } from '../../components/reference-manager';

export default function OrgTypesPage() {
  return (
    <ReferenceManager
      config={{
        name: 'orgTypes',
        section: 'orgType',
        title: 'Tashkilot turlari',
        newButton: "Tur qo'shish",
        columnLabel: 'Tashkilot turi',
      }}
    />
  );
}
