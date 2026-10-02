import type { Criterion, StudentRecord, Activity, DocumentType, Scholarship, ScholarshipApplication } from '../data/types';
import { mockCriteria, mockStudentsList, mockActivities, mockDocumentTypes, mockScholarships, mockScholarshipApplications } from '../data/mockData';
import type { ApplyInput } from './mapper';

let seq = 0;
const nid = (p: string) => `${p}-mock-${seq++}`;
const clone = (list: Criterion[]) =>
  list.map((c) => ({ ...c, categories: c.categories.map((x) => ({ ...x })) }));

let criteriaStore: Criterion[] = clone(mockCriteria);

export const criteriaMock = {
  async list(): Promise<Criterion[]> {
    return clone(criteriaStore);
  },
  async create(c: Partial<Criterion>): Promise<Criterion> {
    const item: Criterion = {
      id: nid('CT'),
      name: c.name ?? '',
      icon: c.icon ?? '📄',
      active: c.active !== false,
      categories: (c.categories ?? []).map((x) => ({
        id: nid('CC'),
        name: x.name,
        points: x.points,
        active: x.active !== false,
      })),
      ...(c.ball != null ? { ball: c.ball } : {}),
    };
    criteriaStore = [...criteriaStore, item];
    return item;
  },
  async update(id: string, data: Partial<Criterion>): Promise<Criterion> {
    criteriaStore = criteriaStore.map((c) => (c.id === id ? ({ ...c, ...data, id } as Criterion) : c));
    return criteriaStore.find((c) => c.id === id) as Criterion;
  },
  async remove(id: string): Promise<void> {
    criteriaStore = criteriaStore.filter((c) => c.id !== id);
  },
};

let studentStore: StudentRecord[] = mockStudentsList.map((s) => ({ ...s, passport: { ...s.passport } }));

export const studentMock = {
  async list(): Promise<StudentRecord[]> {
    return studentStore.map((s) => ({ ...s }));
  },
  async getOne(id: string): Promise<StudentRecord> {
    return studentStore.find((s) => s.id === id) as StudentRecord;
  },
  async create(s: Partial<StudentRecord>): Promise<StudentRecord> {
    const item = { ...(s as StudentRecord), id: nid('STU') };
    studentStore = [item, ...studentStore];
    return item;
  },
  async update(id: string, data: Partial<StudentRecord>): Promise<StudentRecord> {
    studentStore = studentStore.map((s) => (s.id === id ? ({ ...s, ...data, id } as StudentRecord) : s));
    return studentStore.find((s) => s.id === id) as StudentRecord;
  },
  async remove(id: string): Promise<void> {
    studentStore = studentStore.filter((s) => s.id !== id);
  },
};

let achStore: Activity[] = mockActivities.map((a) => ({ ...a }));
export const achievementMock = {
  async all(): Promise<Activity[]> {
    return achStore.map((a) => ({ ...a }));
  },
  async my(): Promise<Activity[]> {
    return achStore.map((a) => ({ ...a }));
  },
  async byStudent(id: string): Promise<Activity[]> {
    return achStore.filter((a) => a.studentId === id);
  },
  async create(a: Partial<Activity>): Promise<Activity> {
    const item = { ...(a as Activity), id: nid('ACT'), status: 'pending' };
    achStore = [item, ...achStore];
    return item;
  },
  async update(id: string, data: Partial<Activity>): Promise<Activity> {
    achStore = achStore.map((a) => (a.id === id ? ({ ...a, ...data, id } as Activity) : a));
    return achStore.find((a) => a.id === id) as Activity;
  },
  async review(id: string, status: string, note?: string): Promise<Activity> {
    achStore = achStore.map((a) => (a.id === id ? ({ ...a, status, reviewNote: note ?? '' }) : a));
    return achStore.find((a) => a.id === id) as Activity;
  },
  async remove(id: string): Promise<void> {
    achStore = achStore.filter((a) => a.id !== id);
  },
};

let schStore: Scholarship[] = mockScholarships.map((s) => ({ ...s }));
export const scholarshipMock = {
  async list(type?: string): Promise<Scholarship[]> {
    return schStore.filter((s) => !type || s.type === type).map((s) => ({ ...s }));
  },
  async getOne(id: string): Promise<Scholarship> {
    return schStore.find((s) => s.id === id) as Scholarship;
  },
  async create(s: Partial<Scholarship>): Promise<Scholarship> {
    const item = { ...(s as Scholarship), id: nid('SCH') };
    schStore = [item, ...schStore];
    return item;
  },
  async update(id: string, data: Partial<Scholarship>): Promise<Scholarship> {
    schStore = schStore.map((s) => (s.id === id ? ({ ...s, ...data, id } as Scholarship) : s));
    return schStore.find((s) => s.id === id) as Scholarship;
  },
  async remove(id: string): Promise<void> {
    schStore = schStore.filter((s) => s.id !== id);
  },
};

let appStore: ScholarshipApplication[] = mockScholarshipApplications.map((a) => ({ ...a }));
export const scholarshipApplicationMock = {
  async my(): Promise<ScholarshipApplication[]> {
    return appStore.map((a) => ({ ...a }));
  },
  async all(): Promise<ScholarshipApplication[]> {
    return appStore.map((a) => ({ ...a }));
  },
  async apply(a: ApplyInput): Promise<ScholarshipApplication> {
    const item: ScholarshipApplication = {
      id: nid('APP'),
      studentId: '',
      scholarshipId: a.scholarshipId,
      scholarshipName: a.scholarshipName,
      status: 'pending',
      appliedAt: '',
      reviewedAt: null,
      academicYear: a.academicYear ?? '',
      note: '',
    };
    appStore = [item, ...appStore];
    return item;
  },
  async review(p: { id: string; status: string; rejectReason?: string }): Promise<void> {
    appStore = appStore.map((a) => (a.id === p.id ? { ...a, status: p.status, note: p.rejectReason ?? a.note } : a));
  },
  async remove(id: string): Promise<void> {
    appStore = appStore.filter((a) => a.id !== id);
  },
};

let dtStore: DocumentType[] = mockDocumentTypes.map((d) => ({ ...d }));
export const docTypeMock = {
  async list(): Promise<DocumentType[]> {
    return dtStore.map((d) => ({ ...d }));
  },
  async create(d: Partial<DocumentType>): Promise<DocumentType> {
    const item = { ...(d as DocumentType), id: nid('DT') };
    dtStore = [...dtStore, item];
    return item;
  },
  async update(id: string, data: Partial<DocumentType>): Promise<DocumentType> {
    dtStore = dtStore.map((d) => (d.id === id ? ({ ...d, ...data, id } as DocumentType) : d));
    return dtStore.find((d) => d.id === id) as DocumentType;
  },
  async remove(id: string): Promise<void> {
    dtStore = dtStore.filter((d) => d.id !== id);
  },
};
