import type React from 'react';

import * as Yup from 'yup';

import dayjs from 'dayjs';



export interface FormValues {

  type: 'leave' | 'resignation' | 'transfer' | '';

  teacher: string;

  reason: string;

  distribution: string;

  fromDate: string;

  toDate: string;

}



export const createLeaveSchema = Yup.object({

  type: Yup.string()

    .oneOf(['leave', 'resignation', 'transfer'], 'studyLoad.teacherLeave.form.typePlaceholder')

    .required('studyLoad.teacherLeave.form.typeRequired'),

  teacher: Yup.string().optional(),

  reason: Yup.string()

    .trim()

    .min(3, 'studyLoad.teacherLeave.form.reasonMin')

    .required('studyLoad.teacherLeave.form.reasonRequired'),

  distribution: Yup.string().optional(),

  fromDate: Yup.string().required('studyLoad.teacherLeave.form.fromDateRequired'),

  toDate: Yup.string().when('type', {

    is: 'leave',

    then: (s) => s.required('studyLoad.teacherLeave.form.toDateRequired'),

    otherwise: (s) => s.optional(),

  }).test('to-after-from', 'studyLoad.teacherLeave.form.toDateBeforeFrom', function toAfterFrom(value) {

    const { fromDate } = this.parent as FormValues;

    if (!value || !fromDate) return true;

    return !dayjs(value).isBefore(dayjs(fromDate), 'day');

  }),

});



export const preventEnterSubmit = (e: React.KeyboardEvent<HTMLFormElement>) => {

  if (e.key !== 'Enter') return;

  const tag = (e.target as HTMLElement).tagName;

  if (tag === 'TEXTAREA' || tag === 'BUTTON') return;

  e.preventDefault();

};



export const emptyValues: FormValues = {

  type: '',

  teacher: '',

  reason: '',

  distribution: '',

  fromDate: '',

  toDate: '',

};
