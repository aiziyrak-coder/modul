import { fieldLabel, fieldOptions } from '../model/field-labels';
import type { DataField, FieldType, Indicator, IndicatorInput } from '../model/types';

const FIELD_TYPES: readonly string[] = [
  'text',
  'number',
  'money',
  'date',
  'select',
  'url',
  'textarea',
  'file',
];

const toFieldType = (value: unknown): FieldType =>
  typeof value === 'string' && FIELD_TYPES.includes(value) ? (value as FieldType) : 'text';

export interface BackendDataField {
  fieldName?: string;
  fieldType?: string;
  required?: boolean;
}

export interface BackendIndicator {
  _id: string;
  title?: string;
  desc?: string | null;
  coefficient?: number;
  dataFields?: BackendDataField[];
  category?: string | null;
  order?: number | null;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function toDataField(field: BackendDataField): DataField {
  const name = field.fieldName ?? '';
  const type = toFieldType(field.fieldType);
  const options = type === 'select' ? fieldOptions(name) : undefined;
  return {
    key: name,
    label: fieldLabel(name),
    type,
    required: field.required ?? false,
    ...(options ? { options } : {}),
  };
}

function toBackendDataField(field: DataField): BackendDataField {
  return {
    fieldName: field.key,
    fieldType: field.type,
    required: field.required ?? false,
  };
}

export function toIndicator(raw: BackendIndicator): Indicator {
  return {
    _id: String(raw._id),
    title: raw.title ?? '',
    desc: raw.desc ?? null,
    coefficient: raw.coefficient ?? 1,
    dataFields: (raw.dataFields ?? []).map(toDataField),
    category: raw.category ?? null,
    order: raw.order ?? null,
    active: raw.active ?? true,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? '',
  };
}

export interface IndicatorCreateBody {
  title: string;
  desc?: string;
  coefficient?: number;
  dataFields?: BackendDataField[];
  category?: string;
  order?: number;
}

export function toCreatePayload(input: IndicatorInput): IndicatorCreateBody {
  return {
    title: input.title,
    ...(input.desc !== undefined ? { desc: input.desc } : {}),
    ...(input.coefficient !== undefined ? { coefficient: input.coefficient } : {}),
    ...(input.dataFields !== undefined
      ? { dataFields: input.dataFields.map(toBackendDataField) }
      : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.order !== undefined ? { order: input.order } : {}),
  };
}

export interface IndicatorUpdateBody extends Partial<IndicatorCreateBody> {
  active?: boolean;
}

export function toUpdatePayload(input: Partial<IndicatorInput>): IndicatorUpdateBody {
  return {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.desc !== undefined ? { desc: input.desc } : {}),
    ...(input.coefficient !== undefined ? { coefficient: input.coefficient } : {}),
    ...(input.dataFields !== undefined
      ? { dataFields: input.dataFields.map(toBackendDataField) }
      : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.order !== undefined ? { order: input.order } : {}),
    ...(input.active !== undefined ? { active: input.active } : {}),
  };
}
