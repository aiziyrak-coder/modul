import * as Yup from 'yup';

const optionalUrl = Yup.string()
  .url('teacher.profile.err.invalidUrl')
  .nullable()
  .transform((v) => (v === '' ? null : v));

export const profileValidationSchema = Yup.object({
  faculty: Yup.string().nullable(),
  department: Yup.string().nullable(),
  position: Yup.string().nullable(),
  phone: Yup.string().nullable(),
  email: Yup.string().email('teacher.profile.err.invalidEmail').nullable(),
  googleScholarUrl: optionalUrl,
  scopusUrl: optionalUrl,
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('uz-UZ');
}
