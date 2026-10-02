import * as Yup from 'yup';

export const staffFormSchema = Yup.object({
  firstName: Yup.string().required('teacher.hr.staff.err.required'),
  lastName: Yup.string().required('teacher.hr.staff.err.required'),
  middleName: Yup.string().nullable(),
  phone: Yup.string().nullable(),
  jshshir: Yup.string()
    .nullable()
    .matches(/^\d{14}$/, { message: 'teacher.hr.staff.err.jshshir', excludeEmptyString: true }),
  passportSeries: Yup.string()
    .nullable()
    .matches(/^[A-Z]{2}$/, { message: 'teacher.hr.staff.err.passportSeries', excludeEmptyString: true }),
  passportNumber: Yup.string()
    .nullable()
    .matches(/^\d{7}$/, { message: 'teacher.hr.staff.err.passportNumber', excludeEmptyString: true }),
  email: Yup.string().email('teacher.hr.staff.err.email').nullable(),
  teachingSpecialtyName: Yup.string().nullable(),
  teachingSpecialtyCode: Yup.string()
    .nullable()
    .matches(/^\d{2}\.\d{2}\.\d{2}$/, {
      message: 'teacher.hr.staff.err.teachingSpecialtyCode',
      excludeEmptyString: true,
    }),
  teachingSpecialtyBasis: Yup.string().nullable(),
  teachingSpecialtyNote: Yup.string().nullable().max(2000, 'teacher.hr.staff.err.teachingSpecialtyNote'),
});
