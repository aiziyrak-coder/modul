export type DocKind = 'sertifikat' | 'malumotnoma';

export type CertTemplate = 1 | 2 | 3;

export const KIND_TO_DOC: Record<number, DocKind> = {
  1: 'sertifikat',
  2: 'malumotnoma',
};

export const DOC_TO_KIND: Record<DocKind, number> = {
  sertifikat: 1,
  malumotnoma: 2,
};

export interface CourseType {
  id: string;
  title: string;
  docKind: DocKind;
  template: CertTemplate;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseTypeInput {
  title: string;
  docKind: DocKind;
  template: CertTemplate;
}
