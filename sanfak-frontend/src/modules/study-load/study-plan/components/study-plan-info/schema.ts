import * as Yup from 'yup';

export const infoSchema = Yup.object({
  direction: Yup.string().required('studyLoad.studyPlan.info.directionRequired'),
  academicLevel: Yup.string().required('studyLoad.studyPlan.info.academicLevelRequired'),
  educationForm: Yup.string().required('studyLoad.studyPlan.info.educationFormRequired'),
  readingForm: Yup.string().required('studyLoad.studyPlan.info.readingFormRequired'),
  specialization: Yup.string().required('studyLoad.studyPlan.info.specializationRequired'),
  year: Yup.string().required('studyLoad.studyPlan.info.yearRequired'),
  studyPeriod: Yup.string().required('studyLoad.studyPlan.info.studyPeriodRequired'),
  comment: Yup.string(),
});

export interface InfoFormValues {
  direction: string;
  academicLevel: string;
  educationForm: string;
  readingForm: string;
  specialization: string;
  year: string;
  studyPeriod: string;
  comment: string;
  studyProcessFile: File | null;
  studyPlanFile: File | null;
}
