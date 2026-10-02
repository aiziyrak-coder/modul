import type { DistributionTeacher } from '../model/types';
import { classTypesIntersect } from '../../lib/class-type-slugs';

export interface AssignedBlockInfo {
  takenGroupIds: string[];
  teacherNames: string[];
  teacherEntryIds: string[];
  takenTypesByGroup: Record<string, string[]>;
}

export function isGroupTakenFor(
  info: AssignedBlockInfo | undefined,
  groupId: string,
  selected: readonly string[],
): boolean {
  const taken = info?.takenTypesByGroup[groupId];
  if (!taken) return false;
  return classTypesIntersect(taken, selected);
}

function mergeTakenTypes(existing: string[] | undefined, incoming: string[] | undefined): string[] {
  if (!Array.isArray(incoming) || incoming.length === 0) return [];
  if (!existing) return [...incoming];
  if (existing.length === 0) return existing;
  return Array.from(new Set([...existing, ...incoming]));
}

export function buildAssignedBlockMap(
  teachers: DistributionTeacher[] | undefined,
): Map<string, AssignedBlockInfo> {
  const map = new Map<string, AssignedBlockInfo>();
  for (const teacher of teachers ?? []) {
    const who = teacher.isVacant ? (teacher.vacantLabel ?? 'Vakant') : teacher.fullName;
    for (const block of teacher.blocks) {
      if (!block.workloadBlockId) continue;
      const entry = map.get(block.workloadBlockId) ?? {
        takenGroupIds: [],
        teacherNames: [],
        teacherEntryIds: [],
        takenTypesByGroup: {},
      };
      for (const gid of block.groupIds) {
        if (!entry.takenGroupIds.includes(gid)) entry.takenGroupIds.push(gid);
        entry.takenTypesByGroup[gid] = mergeTakenTypes(
          entry.takenTypesByGroup[gid],
          block.classTypeSlugs,
        );
      }
      if (!entry.teacherNames.includes(who)) entry.teacherNames.push(who);
      if (!entry.teacherEntryIds.includes(teacher.id)) entry.teacherEntryIds.push(teacher.id);
      map.set(block.workloadBlockId, entry);
    }
  }
  return map;
}
