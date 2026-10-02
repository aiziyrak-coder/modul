export interface BackendReference {
  _id: string;
  title?: string;
  desc?: string;
  active?: boolean;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ReferenceRecord {
  id: string;
  title?: string;
  desc?: string;
  active?: boolean;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export function mapReference(doc: BackendReference): ReferenceRecord {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

export interface ReferenceListResult {
  items: ReferenceRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
