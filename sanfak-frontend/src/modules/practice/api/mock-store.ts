import type {
  Contract,
  ContractStatus,
  ContractStudentLite,
  DistrictRef,
  NotificationItem,
  PracticeBase,
  PracticeRole,
  PracticeStudent,
  RefItem,
} from '../model/types';
import {
  ACADEMIC_YEARS,
  BASES,
  CONTRACTS,
  COURSES,
  DEFAULT_TEMPLATE,
  DIRECTIONS,
  DISTRICTS,
  NOTIFICATIONS,
  ORG_TYPES,
  REGIONS,
  STUDENTS,
} from './mock-data';

const db = {
  orgTypes: [...ORG_TYPES],
  regions: [...REGIONS],
  districts: [...DISTRICTS],
  directions: [...DIRECTIONS],
  academicYears: [...ACADEMIC_YEARS],
  courses: [...COURSES],
  bases: [...BASES],
  students: [...STUDENTS],
  contracts: [...CONTRACTS],
  notifications: [...NOTIFICATIONS],
  template: { ...DEFAULT_TEMPLATE },
};

let seq = 1000;
const genId = (prefix: string) => `${prefix}${(seq += 1)}`;
const delay = <T>(value: T, ms = 200): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const byId = <T extends { id: string }>(arr: T[], id: string) => arr.find((x) => x.id === id);

const firstOf = <T>(arr: T[]): T => {
  const v = arr[0];
  if (!v) throw new Error("Bo'sh reference ro'yxati");
  return v;
};

const resolveRef = <T extends { id: string }>(arr: T[], id: string): T =>
  arr.find((x) => x.id === id) ?? firstOf(arr);

export type ReferenceName =
  | 'orgTypes'
  | 'regions'
  | 'districts'
  | 'directions'
  | 'academicYears'
  | 'courses';

const refArray = (name: ReferenceName): RefItem[] => db[name] as RefItem[];

export const mockReferences = {
  list: (name: ReferenceName, search?: string): Promise<RefItem[]> => {
    let items = refArray(name);
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((x) => x.title.toLowerCase().includes(s));
    }
    return delay(clone(items));
  },
  districtsByRegion: (regionId?: string): Promise<DistrictRef[]> => {
    const items = regionId
      ? db.districts.filter((d) => d.region.id === regionId)
      : db.districts;
    return delay(clone(items));
  },
  create: (name: ReferenceName, title: string, regionId?: string): Promise<RefItem> => {
    if (name === 'districts') {
      const region = byId(db.regions, regionId ?? '') ?? firstOf(db.regions);
      const item: DistrictRef = { id: genId('ds'), title, region };
      db.districts.push(item);
      return delay(clone(item));
    }
    const item: RefItem = { id: genId(name.slice(0, 2)), title };
    refArray(name).push(item);
    return delay(clone(item));
  },
  update: (name: ReferenceName, id: string, title: string, regionId?: string): Promise<RefItem> => {
    const item = refArray(name).find((x) => x.id === id);
    if (item) {
      item.title = title;
      if (name === 'districts' && regionId) {
        const region = byId(db.regions, regionId);
        if (region) (item as DistrictRef).region = region;
      }
    }
    return delay(clone(item as RefItem));
  },
  remove: (name: ReferenceName, id: string): Promise<{ id: string }> => {
    const arr = refArray(name);
    const idx = arr.findIndex((x) => x.id === id);
    if (idx >= 0) arr.splice(idx, 1);
    return delay({ id });
  },
};

export interface BaseInput {
  title: string;
  orgTypeId: string;
  stir: string;
  regionId: string;
  districtId: string;
  address: string;
  headName: string;
  headJshshir: string;
  headPhone: string;
  email?: string | null;
  capacity?: number | null;
  responsibleUserIds?: string[];
}

const resolveBase = (input: BaseInput, id: string): PracticeBase => ({
  id,
  title: input.title,
  orgType: resolveRef(db.orgTypes, input.orgTypeId),
  stir: input.stir,
  region: resolveRef(db.regions, input.regionId),
  district: resolveRef(db.districts, input.districtId),
  address: input.address,
  headName: input.headName,
  headJshshir: input.headJshshir,
  headPhone: input.headPhone,
  email: input.email ?? null,
  capacity: input.capacity ?? null,
  responsibleUsers: [],
  active: true,
});

export const mockBases = {
  list: (filters: { search?: string; orgTypeId?: string; regionId?: string } = {}): Promise<PracticeBase[]> => {
    let items = db.bases;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      items = items.filter(
        (b) =>
          b.title.toLowerCase().includes(s) ||
          b.stir.includes(filters.search as string) ||
          b.headName.toLowerCase().includes(s),
      );
    }
    if (filters.orgTypeId) items = items.filter((b) => b.orgType.id === filters.orgTypeId);
    if (filters.regionId) items = items.filter((b) => b.region.id === filters.regionId);
    return delay(clone(items));
  },
  getOne: (id: string): Promise<PracticeBase | undefined> => delay(clone(byId(db.bases, id))),
  create: (input: BaseInput): Promise<PracticeBase> => {
    if (db.bases.some((b) => b.stir === input.stir)) {
      return Promise.reject(new Error("Bu STIR allaqachon ro'yxatga olingan"));
    }
    const base = resolveBase(input, genId('b'));
    base.createdAt = new Date().toISOString().slice(0, 10);
    db.bases.unshift(base);
    return delay(clone(base));
  },
  update: (id: string, input: BaseInput): Promise<PracticeBase> => {
    if (db.bases.some((b) => b.stir === input.stir && b.id !== id)) {
      return Promise.reject(new Error("Bu STIR allaqachon ro'yxatga olingan"));
    }
    const idx = db.bases.findIndex((b) => b.id === id);
    const current = db.bases[idx];
    if (idx < 0 || !current) return Promise.reject(new Error('Topilmadi'));
    const updated: PracticeBase = { ...resolveBase(input, id), createdAt: current.createdAt };
    db.bases[idx] = updated;
    return delay(clone(updated));
  },
  remove: (id: string): Promise<{ id: string }> => {
    db.bases = db.bases.filter((b) => b.id !== id);
    return delay({ id });
  },
};

export interface StudentInput {
  fish: string;
  academicYearId: string;
  directionId: string;
  course: number;
  group: string;
  regionId: string;
  districtId: string;
}

const resolveStudent = (input: StudentInput, id: string): PracticeStudent => ({
  id,
  fish: input.fish,
  academicYear: resolveRef(db.academicYears, input.academicYearId),
  direction: resolveRef(db.directions, input.directionId),
  course: input.course,
  group: input.group,
  region: resolveRef(db.regions, input.regionId),
  district: resolveRef(db.districts, input.districtId),
  active: true,
});

export const mockStudents = {
  list: (
    filters: {
      search?: string;
      regionId?: string;
      directionId?: string;
      academicYearId?: string;
      course?: number;
    } = {},
  ): Promise<PracticeStudent[]> => {
    let items = db.students;
    if (filters.search) {
      const s = filters.search.toLowerCase();
      items = items.filter(
        (st) => st.fish.toLowerCase().includes(s) || st.group.toLowerCase().includes(s),
      );
    }
    if (filters.regionId) items = items.filter((st) => st.region.id === filters.regionId);
    if (filters.directionId) items = items.filter((st) => st.direction.id === filters.directionId);
    if (filters.academicYearId)
      items = items.filter((st) => st.academicYear.id === filters.academicYearId);
    if (filters.course) items = items.filter((st) => st.course === filters.course);
    return delay(clone(items));
  },
  create: (input: StudentInput): Promise<PracticeStudent> => {
    const st = resolveStudent(input, genId('s'));
    db.students.unshift(st);
    return delay(clone(st));
  },
  update: (id: string, input: StudentInput): Promise<PracticeStudent> => {
    const idx = db.students.findIndex((s) => s.id === id);
    if (idx < 0) return Promise.reject(new Error('Topilmadi'));
    const updated = resolveStudent(input, id);
    db.students[idx] = updated;
    return delay(clone(updated));
  },
  remove: (id: string): Promise<{ id: string }> => {
    db.students = db.students.filter((s) => s.id !== id);
    return delay({ id });
  },
  bulkCourseTransfer: (ids: string[], toCourse: number): Promise<{ modifiedCount: number }> => {
    let modifiedCount = 0;
    db.students.forEach((s) => {
      if (ids.includes(s.id)) {
        s.course = toCourse;
        modifiedCount += 1;
      }
    });
    return delay({ modifiedCount });
  },
};

export interface ContractInput {
  organizationId: string;
  directionId: string;
  academicYearId: string;
  course?: number;
  group?: string;
  studentIds: string[];
  startDate: string;
  endDate: string;
  note?: string | null;
}

const toLite = (st: PracticeStudent): ContractStudentLite => ({
  id: st.id,
  fish: st.fish,
  group: st.group,
});

const resolveContract = (input: ContractInput, base: Partial<Contract>): Contract => {
  const students = db.students.filter((s) => input.studentIds.includes(s.id)).map(toLite);
  return {
    id: base.id ?? genId('k'),
    number: base.number ?? '',
    organization: resolveRef(db.bases, input.organizationId),
    direction: resolveRef(db.directions, input.directionId),
    academicYear: resolveRef(db.academicYears, input.academicYearId),
    course: input.course ?? null,
    group: input.group ?? null,
    students,
    studentsCount: students.length,
    startDate: input.startDate,
    endDate: input.endDate,
    note: input.note ?? null,
    status: base.status ?? 'draft',
    rector: base.rector ?? { signed: false },
    orgHead: base.orgHead ?? { signed: false },
    rejectReason: base.rejectReason ?? null,
    rejectedBy: base.rejectedBy ?? null,
    history: base.history ?? [],
    createdAt: base.createdAt ?? new Date().toISOString().slice(0, 10),
  };
};

const nextNumber = () => {
  const year = new Date().getFullYear();
  const n = db.contracts.length + 1;
  return `AM-${String(n).padStart(4, '0')}/${year}`;
};

const nowIso = () => new Date().toISOString();

export const mockContracts = {
  list: (
    filters: {
      search?: string;
      status?: ContractStatus;
      academicYearId?: string;
      directionId?: string;
      visibleStatuses?: ContractStatus[] | null;
    } = {},
  ): Promise<Contract[]> => {
    let items = db.contracts;
    if (filters.visibleStatuses)
      items = items.filter((c) => filters.visibleStatuses!.includes(c.status));
    if (filters.status) items = items.filter((c) => c.status === filters.status);
    if (filters.academicYearId)
      items = items.filter((c) => c.academicYear.id === filters.academicYearId);
    if (filters.directionId) items = items.filter((c) => c.direction.id === filters.directionId);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      items = items.filter(
        (c) =>
          c.number.toLowerCase().includes(s) ||
          c.organization.title.toLowerCase().includes(s),
      );
    }
    return delay(clone(items));
  },
  getOne: (id: string): Promise<Contract | undefined> => delay(clone(byId(db.contracts, id))),
  create: (input: ContractInput): Promise<Contract> => {
    const contract = resolveContract(input, {
      number: nextNumber(),
      status: 'draft',
      history: [{ at: nowIso(), actor: "Amaliyot bo'limi", action: 'Shartnoma yaratildi' }],
    });
    db.contracts.unshift(contract);
    return delay(clone(contract));
  },
  update: (id: string, input: ContractInput): Promise<Contract> => {
    const idx = db.contracts.findIndex((c) => c.id === id);
    const current = db.contracts[idx];
    if (idx < 0 || !current) return Promise.reject(new Error('Topilmadi'));
    const resetFromRejected = current.status === 'rejected';
    const history = [...current.history];
    if (resetFromRejected) {
      history.push({
        at: nowIso(),
        actor: "Amaliyot bo'limi",
        action: "Tahrirlanib qayta 'Yangi' holatiga keltirildi",
      });
    }
    const updated = resolveContract(input, {
      id,
      number: current.number,
      status: resetFromRejected ? 'draft' : current.status,
      rector: resetFromRejected ? { signed: false } : current.rector,
      orgHead: resetFromRejected ? { signed: false } : current.orgHead,
      rejectReason: resetFromRejected ? null : current.rejectReason,
      rejectedBy: resetFromRejected ? null : current.rejectedBy,
      history,
      createdAt: current.createdAt,
    });
    db.contracts[idx] = updated;
    return delay(clone(updated));
  },
  remove: (id: string): Promise<{ id: string }> => {
    db.contracts = db.contracts.filter((c) => c.id !== id);
    return delay({ id });
  },
  sendToRector: (id: string): Promise<Contract> => {
    const c = byId(db.contracts, id);
    if (!c) return Promise.reject(new Error('Topilmadi'));
    c.status = 'in_progress';
    c.history.push({ at: nowIso(), actor: "Amaliyot bo'limi", action: 'Rektorga tasdiqlashga yuborildi' });
    return delay(clone(c));
  },
  rectorSign: (id: string, cert: { serialNumber: string; subject: string }): Promise<Contract> => {
    const c = byId(db.contracts, id);
    if (!c) return Promise.reject(new Error('Topilmadi'));
    c.status = 'rektor_approved';
    c.rector = { signed: true, signer: cert.subject, signedAt: nowIso(), certInfo: cert };
    c.history.push({ at: nowIso(), actor: 'Rektor', action: 'Rektor ERI bilan tasdiqladi' });
    return delay(clone(c));
  },
  orgSign: (id: string, cert: { serialNumber: string; subject: string }): Promise<Contract> => {
    const c = byId(db.contracts, id);
    if (!c) return Promise.reject(new Error('Topilmadi'));
    c.status = 'both_approved';
    c.orgHead = { signed: true, signer: cert.subject, signedAt: nowIso(), certInfo: cert };
    c.history.push({ at: nowIso(), actor: 'Tibbiyot birlashmasi rahbari', action: 'Rahbar ERI bilan tasdiqladi (yakuniy)' });
    return delay(clone(c));
  },
  reject: (id: string, reason: string, rejectedBy: 'rektor' | 'org_head'): Promise<Contract> => {
    const c = byId(db.contracts, id);
    if (!c) return Promise.reject(new Error('Topilmadi'));
    c.status = 'rejected';
    c.rejectReason = reason;
    c.rejectedBy = rejectedBy;
    const actor = rejectedBy === 'rektor' ? 'Rektor' : 'Tibbiyot birlashmasi rahbari';
    c.history.push({ at: nowIso(), actor, action: 'Rad etildi (sabab bilan)', reason });
    return delay(clone(c));
  },
  tabsCount: (visibleStatuses?: ContractStatus[] | null): Promise<Record<string, number>> => {
    const items = visibleStatuses
      ? db.contracts.filter((c) => visibleStatuses.includes(c.status))
      : db.contracts;
    const counts: Record<string, number> = { all: items.length };
    items.forEach((c) => {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    });
    return delay(counts);
  },
  paginate: async (
    filters: {
      search?: string;
      status?: ContractStatus | ContractStatus[] | null;
      academicYearId?: string;
      directionId?: string;
      visibleStatuses?: ContractStatus[] | null;
    } = {},
    page = 1,
    limit = 12,
  ): Promise<{
    docs: Contract[];
    totalDocs: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextPage: number | null;
    prevPage: number | null;
  }> => {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : filters.status
        ? [filters.status]
        : [];
    const all = await mockContracts.list({
      ...filters,
      status: statuses.length === 1 ? statuses[0] : undefined,
    });
    const filtered = statuses.length > 1 ? all.filter((c) => statuses.includes(c.status)) : all;
    const start = (page - 1) * limit;
    const docs = filtered.slice(start, start + limit);
    const totalDocs = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalDocs / limit));
    return {
      docs,
      totalDocs,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    };
  },
};

export const mockNotifications = {
  list: (role: PracticeRole): Promise<NotificationItem[]> =>
    delay(clone(db.notifications.filter((n) => n.forRole === role))),
  unreadCount: (role: PracticeRole): Promise<number> =>
    delay(db.notifications.filter((n) => n.forRole === role && !n.read).length),
  markRead: (id: string): Promise<{ id: string }> => {
    const n = byId(db.notifications, id);
    if (n) n.read = true;
    return delay({ id });
  },
  markAllRead: (role: PracticeRole): Promise<{ ok: true }> => {
    db.notifications.forEach((n) => {
      if (n.forRole === role) n.read = true;
    });
    return delay({ ok: true });
  },
};

export const mockTemplate = {
  get: (): Promise<{ id: string; body: string }> => delay(clone(db.template)),
  save: (body: string): Promise<{ id: string; body: string }> => {
    db.template.body = body;
    return delay(clone(db.template));
  },
};
