import type { DistributionBlock, DistributionTeacher } from '../../model/types';
import { lookupClassType, lookupStudyWorkItem } from '../../api/mapper';
import type { BlockJustification, SuitabilityFlag } from '../../lib/suitability';

const CT = {
  LECTURE: 'lecture',
  CLINICAL_PRACTICE: 'clinical_practice',
  LAB_TRAINING: 'lab_training',
  PRACTICAL: 'practical',
  STUDENT_WORK: 'student_work',
  YAN: 'yan',
  MISSED: 'missed_lesson',
  SKILLED: 'skilled_practice',
} as const;

export type RowKind = 'teacher' | 'block' | 'summary';

export interface DistRow {
  key: string;
  kind: RowKind;
  teacher?: DistributionTeacher;

  scienceName: string | null;
  classTypeSlugs?: string[];
  course: number | string;
  studentCount: number | string;
  groupCount: number | string;
  streamCount: number | string;
  semester: number | string;
  semTotalHour: number | string;
  auditoriumHour: number | string;
  lectStream: number | string;
  lectTotal: number | string;
  clinStream: number | string;
  clinTotal: number | string;
  labStream: number | string;
  labTotal: number | string;
  pratStream: number | string;
  pratTotal: number | string;
  oraliq: number | string;
  yakuniy: number | string;
  qoldirilgan: number | string;
  malakaviy: number | string;
  totalHour: number | string;

  blockId: string | null;
  teacherEntryId: string | null;
  blockScienceName: string | null;
  blockScienceId: string | null;
  blockSuitability: SuitabilityFlag | null;
  blockJustification: BlockJustification | null;
}

const EMPTY_CELLS = {
  scienceName: null,
  course: '',
  studentCount: '',
  groupCount: '',
  streamCount: '',
  semester: '',
  semTotalHour: '',
  auditoriumHour: '',
  lectStream: '',
  lectTotal: '',
  clinStream: '',
  clinTotal: '',
  labStream: '',
  labTotal: '',
  pratStream: '',
  pratTotal: '',
  oraliq: '',
  yakuniy: '',
  qoldirilgan: '',
  malakaviy: '',
  totalHour: '',
  blockId: null,
  teacherEntryId: null,
  blockScienceName: null,
  blockScienceId: null,
  blockSuitability: null,
  blockJustification: null,
} as const;

export function blockToRow(b: DistributionBlock, teacherEntryId: string): DistRow {
  const lect = lookupClassType(b.classTypes, CT.LECTURE, 'maruza');
  const clin = lookupClassType(b.classTypes, CT.CLINICAL_PRACTICE, 'klinik_amaliyot');
  const lab = lookupClassType(b.classTypes, CT.LAB_TRAINING, 'laboratoriya');
  const prat = lookupClassType(b.classTypes, CT.PRACTICAL, 'amaliy');

  return {
    key: b.id,
    kind: 'block',
    scienceName: b.scienceName,
    classTypeSlugs: b.classTypeSlugs,
    course: b.course,
    studentCount: b.studentCount,
    groupCount: b.groupCount,
    streamCount: b.streamCount,
    semester: b.semester,
    semTotalHour: b.semTotalHour,
    auditoriumHour: b.auditoriumHour,
    lectStream: lect.stream,
    lectTotal: lect.total,
    clinStream: clin.stream,
    clinTotal: clin.total,
    labStream: lab.stream,
    labTotal: lab.total,
    pratStream: prat.stream,
    pratTotal: prat.total,
    oraliq: lookupStudyWorkItem(b.studyWorkItems, CT.STUDENT_WORK, 'on'),
    yakuniy: lookupStudyWorkItem(b.studyWorkItems, CT.YAN, 'yan'),
    qoldirilgan: lookupStudyWorkItem(b.studyWorkItems, CT.MISSED, 'qoldirilgan'),
    malakaviy: lookupStudyWorkItem(b.studyWorkItems, CT.SKILLED, 'malakaviy'),
    totalHour: b.totalHour,
    blockId: b.id,
    teacherEntryId,
    blockScienceName: b.scienceName,
    blockScienceId: b.scienceId,
    blockSuitability: b.suitability,
    blockJustification: b.justification,
  };
}

export function makeSummaryRow(rows: DistRow[], teacherId: string): DistRow {
  const sum = (key: keyof DistRow): number =>
    rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  return {
    ...EMPTY_CELLS,
    key: `${teacherId}-summary`,
    kind: 'summary',
    scienceName: 'Jami:',
    semTotalHour: sum('semTotalHour') || '',
    auditoriumHour: sum('auditoriumHour') || '',
    lectStream: sum('lectStream') || '',
    lectTotal: sum('lectTotal') || '',
    clinStream: sum('clinStream') || '',
    clinTotal: sum('clinTotal') || '',
    labStream: sum('labStream') || '',
    labTotal: sum('labTotal') || '',
    pratStream: sum('pratStream') || '',
    pratTotal: sum('pratTotal') || '',
    oraliq: sum('oraliq') || '',
    yakuniy: sum('yakuniy') || '',
    qoldirilgan: sum('qoldirilgan') || '',
    malakaviy: sum('malakaviy') || '',
    totalHour: sum('totalHour') || '',
  };
}

export function buildDistributionRows(
  teachers: DistributionTeacher[],
): (DistRow & { subRows?: DistRow[] })[] {
  return teachers.map((teacher) => {
    const blockRows = teacher.blocks.map((b) => blockToRow(b, teacher.id));
    const subRows =
      blockRows.length > 0 ? [...blockRows, makeSummaryRow(blockRows, teacher.id)] : [];

    return {
      ...EMPTY_CELLS,
      key: teacher.id,
      kind: 'teacher' as const,
      teacher,
      subRows,
    };
  });
}
