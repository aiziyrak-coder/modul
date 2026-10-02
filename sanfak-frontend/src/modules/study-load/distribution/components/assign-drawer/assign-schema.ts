import * as Yup from 'yup';
import type { TFunction } from 'i18next';
import type { StreamInput } from '../../model/types';
import { ASSIGNMENT_BASES, justificationNoteMinLength, type AssignmentBasis } from '../../lib/suitability';

export interface AssignFormValues {
  teacher: string;
  stavka: number;
  isVacant: boolean;
  vacantLabel: string;
  workloadBlockId: string;
  semester: number;
  groups: string[];
  streams: StreamInput[];
  classTypeSlugs: string[];
  suitabilityBasis: AssignmentBasis | '';
  suitabilityNote: string;
}

export const assignInitialValues: AssignFormValues = {
  teacher: '',
  stavka: 1.0,
  isVacant: false,
  vacantLabel: 'Vakant',
  workloadBlockId: '',
  semester: 1,
  groups: [],
  streams: [],
  classTypeSlugs: [],
  suitabilityBasis: '',
  suitabilityNote: '',
};

export function withCurrentStavka(allowedStakes: number[], current: number): number[] {
  return Array.from(new Set([...allowedStakes, current])).sort((a, b) => a - b);
}

export function makeAssignSchema(
  t: TFunction,
  allowedStakes: number[],
  requiresJustification = false,
  plannedClassTypeCount = 0,
) {
  return Yup.object({
    teacher: Yup.string().when('isVacant', {
      is: false,
      then: (s) => s.required(t('studyLoad.distribution.assign.teacherRequired')),
      otherwise: (s) => s.optional(),
    }),
    stavka: Yup.number()
      .oneOf(
        allowedStakes,
        t('studyLoad.distribution.assign.stavkaOneOf', { values: allowedStakes.join(', ') }),
      )
      .required(t('studyLoad.distribution.assign.stavkaRequired')),
    isVacant: Yup.boolean().required(),
    vacantLabel: Yup.string().when('isVacant', {
      is: true,
      then: (s) => s.required(t('studyLoad.distribution.assign.vacantLabelRequired')),
      otherwise: (s) => s.optional(),
    }),
    workloadBlockId: Yup.string().required(t('studyLoad.distribution.assign.blockRequired')),
    semester: Yup.number()
      .oneOf([1, 2], t('studyLoad.distribution.assign.semesterOneOf'))
      .required(),
    groups: Yup.array(Yup.string().required()).default([]),
    classTypeSlugs:
      plannedClassTypeCount > 0
        ? Yup.array(Yup.string().required())
            .min(1, t('studyLoad.distribution.assign.classTypesRequired'))
            .default([])
        : Yup.array(Yup.string().required()).default([]),
    streams: Yup.array(
      Yup.object({
        number: Yup.number().required(),
        groups: Yup.array(Yup.string().required()).required(),
        language: Yup.string().nullable().optional(),
      }),
    ).default([]),
    suitabilityBasis: requiresJustification
      ? Yup.string()
          .oneOf([...ASSIGNMENT_BASES], t('studyLoad.distribution.assign.basisRequired'))
          .required(t('studyLoad.distribution.assign.basisRequired'))
      : Yup.string().optional(),
    suitabilityNote: requiresJustification
      ? Yup.string()
          .required(t('studyLoad.distribution.assign.noteRequired'))
          .test('min-length', function (value) {
            const basis = (this.parent as { suitabilityBasis?: string }).suitabilityBasis as
              | AssignmentBasis
              | undefined;
            const min = justificationNoteMinLength(basis ?? null);
            if (typeof value === 'string' && value.trim().length >= min) return true;
            return this.createError({
              message: t('studyLoad.distribution.assign.noteMinLength', { n: min }),
            });
          })
      : Yup.string().optional(),
  });
}
