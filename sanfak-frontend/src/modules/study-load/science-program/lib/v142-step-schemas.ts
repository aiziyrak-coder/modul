import * as Yup from 'yup';
import { TOPIC_TYPES } from './v142-defaults';

export const PROTOCOL_NUMBER_RX = /^[0-9]+(?:[/-][0-9A-Za-z]+)?$/;

const protocolSchema = Yup.object({
  date: Yup.string().nullable(),
  number: Yup.string()
    .max(20, 'scienceProgram.v142.validation.protocolNumber')
    .test(
      'protocol-format',
      'scienceProgram.v142.validation.protocolNumber',
      (v) => !v || PROTOCOL_NUMBER_RX.test(v.trim()),
    ),
});

const personSchema = Yup.object({
  fio: Yup.string().test(
    'fio-required-when-any',
    'scienceProgram.v142.validation.fioRequired',
    function (fio) {
      const p = this.parent as Record<string, string | undefined>;
      const anyOther = ['degree', 'title', 'department', 'position'].some((k) =>
        (p[k] ?? '').trim(),
      );
      return !anyOther || Boolean((fio ?? '').trim());
    },
  ),
});

export const v142Step1Schema = Yup.object({
  science: Yup.string().required('scienceProgram.validation.scienceRequired'),
  councilProtocol: protocolSchema,
  departmentProtocol: protocolSchema,
  authors: Yup.array().of(personSchema),
  reviewers: Yup.array().of(personSchema),
});

export const v142Step2Schema = Yup.object({});

const topicSchema = Yup.object({
  type: Yup.string()
    .oneOf([...TOPIC_TYPES], 'scienceProgram.v142.validation.topicTypeRequired')
    .required('scienceProgram.v142.validation.topicTypeRequired'),
  title: Yup.string().trim().required('scienceProgram.v142.validation.topicTitleRequired'),
  hours: Yup.number()
    .typeError('scienceProgram.v142.validation.topicHoursMin')
    .integer('scienceProgram.v142.validation.topicHoursMin')
    .min(1, 'scienceProgram.v142.validation.topicHoursMin')
    .max(999, 'scienceProgram.v142.validation.hoursMax')
    .required('scienceProgram.v142.validation.topicHoursMin'),
});

const independentTaskSchema = Yup.object({
  title: Yup.string().trim().required('scienceProgram.v142.validation.topicTitleRequired'),
  hours: Yup.number()
    .typeError('scienceProgram.v142.validation.hoursMin0')
    .integer('scienceProgram.v142.validation.hoursMin0')
    .min(0, 'scienceProgram.v142.validation.hoursMin0')
    .max(999, 'scienceProgram.v142.validation.hoursMax')
    .required('scienceProgram.v142.validation.hoursMin0'),
});

export const v142Step3Schema = Yup.object({
  topics: Yup.array().of(topicSchema),
  independentTasks: Yup.array().of(independentTaskSchema),
});

export const v142Step4Schema = Yup.object({});
export const v142Step5Schema = Yup.object({});

export const V142_STEP_SCHEMAS = [
  v142Step1Schema,
  v142Step2Schema,
  v142Step3Schema,
  v142Step4Schema,
  v142Step5Schema,
];
