import * as Yup from 'yup';

export const step1Schema = Yup.object({
  science: Yup.string().required('syllabus.validation.scienceRequired'),
  scienceProgram: Yup.string().required('syllabus.validation.scienceProgramRequired'),
});

const step2Schema = Yup.object({});
const step3Schema = Yup.object({});

export const STEP_SCHEMAS = [step1Schema, step2Schema, step3Schema];
