import { ReferenceManager } from '../../components/reference-manager';

export default function CoursesPage() {
  return (
    <ReferenceManager
      config={{
        name: 'courses',
        section: 'course',
        title: 'Kurslar',
        newButton: "Kurs qo'shish",
        columnLabel: 'Kurs',
        pattern: {
          re: /^[1-9]\d*-kurs$/,
          message: 'Kurs "N-kurs" formatida bo\'lishi kerak (masalan: 1-kurs, 2-kurs ...)',
        },
      }}
    />
  );
}
