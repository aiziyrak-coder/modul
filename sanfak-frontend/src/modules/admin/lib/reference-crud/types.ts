import type { ReactNode } from 'react';
import type { ReferenceRecord } from './reference-types';

export type ReferenceFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'switch'
  | 'select'
  | 'multiselect'
  | 'image'
  | 'numberlist';

export interface ReferenceField {
  name: string;
  labelKey: string;
  type: ReferenceFieldType;
  required?: boolean;
  requiredOnCreate?: boolean;
  placeholderKey?: string;
  span?: number;
  optionsRoot?: string;
  valueFrom?: string;
}

export interface ReferenceColumn {
  key: string;
  titleKey: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render?: (record: ReferenceRecord) => ReactNode;
}

export interface ReferenceConfig {
  section: string;
  root: string;
  basePath: string;
  multipart?: boolean;
  searchable?: boolean;
  labels: {
    listTitleKey: string;
    newButtonKey: string;
    createTitleKey: string;
    editTitleKey: string;
    searchPlaceholderKey: string;
  };
  columns: ReferenceColumn[];
  fields: ReferenceField[];
}
