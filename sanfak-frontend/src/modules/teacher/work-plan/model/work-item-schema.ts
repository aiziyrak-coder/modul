import * as Yup from 'yup';
import type { WorkItem, WorkItemFormValues } from './types';

export const workItemValidationSchema = Yup.object({
  title: Yup.string().trim().required('teacher.personalPlan.form.titleRequired'),
  plannedCount: Yup.number().nullable().min(0, 'teacher.personalPlan.form.plannedCountMin'),
  semester: Yup.array().of(Yup.number()),
  deadline: Yup.string().nullable(),
  venue: Yup.string(),
});

export const emptyWorkItemFormValues: WorkItemFormValues = {
  title: '',
  plannedCount: null,
  semester: [],
  deadline: null,
  venue: '',
};

export function toWorkItemInitialValues(item: WorkItem | null): WorkItemFormValues {
  if (!item) return emptyWorkItemFormValues;
  return {
    title: item.title,
    plannedCount: item.plannedCount,
    semester: item.semester,
    deadline: item.deadline,
    venue: item.venue ?? '',
  };
}
