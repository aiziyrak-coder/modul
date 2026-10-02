import type { MyWorkload, MyWorkloadEntry, MyWorkloadBlock, MyWorkloadRow } from '../model/types';

interface BackendBlock {
  blockId?: string;
  classTypeSlugs?: string[] | null;
  science?: { _id: string; title: string } | null;
  course?: number;
  semester?: number;
  totalHour?: number;
  type?: string | null;
  acceptanceStatus?: string;
  rejectionReason?: string | null;
  respondedAt?: string | null;
}

interface BackendEntry {
  teacherEntryId: string;
  acceptanceStatus?: string;
  rejectionReason?: string | null;
  respondedAt?: string | null;
  stavka?: number;
  totalHour?: number;
  blocks?: BackendBlock[];
}

export interface BackendMyDistribution {
  _id: string;
  academicYear?: { _id: string; title: string } | null;
  course?: number;
  totalHour?: number;
  status?: string;
  date?: string | null;
  myEntries?: BackendEntry[];
  superseded?: boolean | null;
  supersededAt?: string | null;
}

interface EntryFallback {
  acceptanceStatus: 'pending' | 'accepted' | 'rejected';
  rejectionReason: string | null;
  respondedAt: string | null;
}

function mapBlock(b: BackendBlock, entryFallback: EntryFallback): MyWorkloadBlock {
  return {
    blockId: b.blockId ?? null,
    scienceName: b.science?.title ?? null,
    classTypeSlugs: Array.isArray(b.classTypeSlugs) ? b.classTypeSlugs.map(String) : [],
    course: b.course ?? 0,
    semester: b.semester ?? 1,
    totalHour: b.totalHour ?? 0,
    type: b.type ?? null,
    acceptanceStatus:
      b.acceptanceStatus !== undefined
        ? normalizeAcceptanceStatus(b.acceptanceStatus)
        : entryFallback.acceptanceStatus,
    rejectionReason: b.rejectionReason !== undefined ? (b.rejectionReason ?? null) : entryFallback.rejectionReason,
    respondedAt: b.respondedAt !== undefined ? (b.respondedAt ?? null) : entryFallback.respondedAt,
  };
}

function normalizeAcceptanceStatus(raw: string | undefined): 'pending' | 'accepted' | 'rejected' {
  if (raw === 'accepted' || raw === 'rejected') return raw;
  return 'pending';
}

function mapEntry(e: BackendEntry): MyWorkloadEntry {
  const entryFallback: EntryFallback = {
    acceptanceStatus: normalizeAcceptanceStatus(e.acceptanceStatus),
    rejectionReason: e.rejectionReason ?? null,
    respondedAt: e.respondedAt ?? null,
  };
  return {
    teacherEntryId: e.teacherEntryId,
    acceptanceStatus: entryFallback.acceptanceStatus,
    stavka: e.stavka ?? 1,
    totalHour: e.totalHour ?? 0,
    blocks: (e.blocks ?? []).map((b) => mapBlock(b, entryFallback)),
    rejectionReason: entryFallback.rejectionReason,
    respondedAt: entryFallback.respondedAt,
  };
}

export function mapMyDistribution(b: BackendMyDistribution): MyWorkload {
  return {
    id: b._id,
    academicYearTitle: b.academicYear?.title ?? null,
    course: b.course ?? 0,
    totalHour: b.totalHour ?? 0,
    status: b.status ?? 'draft',
    date: b.date ?? null,
    myEntries: (b.myEntries ?? []).map(mapEntry),
    superseded: b.superseded === true || b.status === 'superseded',
  };
}

export function flattenToRows(distributions: MyWorkload[]): MyWorkloadRow[] {
  const rows: MyWorkloadRow[] = [];
  for (const dist of distributions) {
    for (const entry of dist.myEntries) {
      if (entry.blocks.length === 0) {
        rows.push({
          rowKey: `${dist.id}__${entry.teacherEntryId}__empty`,
          distributionId: dist.id,
          teacherEntryId: entry.teacherEntryId,
          blockId: null,
          acceptanceStatus: entry.acceptanceStatus,
          entryAcceptanceStatus: entry.acceptanceStatus,
          scienceName: null,
          classTypeSlugs: [],
          course: dist.course,
          semester: 0,
          blockTotalHour: 0,
          type: null,
          entryTotalHour: entry.totalHour,
          academicYearTitle: dist.academicYearTitle,
          date: dist.date,
          distributionStatus: dist.status,
          superseded: dist.superseded === true,
          rejectionReason: entry.rejectionReason,
        });
      } else {
        entry.blocks.forEach((block, idx) => {
          rows.push({
            rowKey: `${dist.id}__${entry.teacherEntryId}__${block.blockId ?? `idx${idx}`}`,
            distributionId: dist.id,
            teacherEntryId: entry.teacherEntryId,
            blockId: block.blockId,
            acceptanceStatus: block.acceptanceStatus,
            entryAcceptanceStatus: entry.acceptanceStatus,
            scienceName: block.scienceName,
            classTypeSlugs: block.classTypeSlugs,
            course: block.course,
            semester: block.semester,
            blockTotalHour: block.totalHour,
            type: block.type,
            entryTotalHour: entry.totalHour,
            academicYearTitle: dist.academicYearTitle,
            date: dist.date,
            distributionStatus: dist.status,
            superseded: dist.superseded === true,
            rejectionReason: block.rejectionReason,
          });
        });
      }
    }
  }
  return rows;
}
