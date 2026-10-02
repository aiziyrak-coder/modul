import { ReferenceManager } from '../../components/reference-manager';

export default function AcademicYearsPage() {
  return (
    <ReferenceManager
      config={{
        name: 'academicYears',
        section: 'academicYear',
        title: "O'quv yillari",
        newButton: "O'quv yili qo'shish",
        columnLabel: "O'quv yili (2026/2027)",
        pattern: {
          re: /^\d{4}\/\d{4}$/,
          message: "Format: YYYY/YYYY — masalan 2026/2027",
        },
      }}
    />
  );
}
