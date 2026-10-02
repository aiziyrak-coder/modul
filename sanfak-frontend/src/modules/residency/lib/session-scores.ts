import type {
  LessonSession,
  LessonSessionDetail,
  SessionRosterRow,
  SessionScoreInput,
} from '../api/session-types';
import { SESSION_SCORE_MAX } from '../api/session-types';
import { normalizeDecimalText } from '../components/common/NumberField/parse-decimal-input';
import { isLessonTypeGraded } from './lesson-type';

export type ScoreEdits = Readonly<Record<string, string>>;

export const scoreText = (score: number | null): string => (score === null ? '' : String(score));

export function parseScoreText(raw: string): number | null {
  const s = normalizeDecimalText(raw.trim());
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

export const isScoreInvalid = (v: number | null): boolean =>
  v !== null && (Number.isNaN(v) || v < 0 || v > SESSION_SCORE_MAX);

const SERVER_MAX_RE = /"score" must be less than or equal to (\d+(?:\.\d+)?)/;

export function oldScaleRejectText(status: number | null, message: string): string | null {
  if (status !== 400) return null;
  const match = SERVER_MAX_RE.exec(message);
  const serverMax = match ? Number(match[1]) : Number.NaN;
  if (!(serverMax < SESSION_SCORE_MAX)) return null;
  return `Server hali eski 0–${serverMax} shkalasida — ball saqlanmadi, administratorga xabar bering`;
}

export const isSessionGradable = (s: Pick<LessonSession, 'status' | 'lessonType'>): boolean =>
  s.status === 'announced' && isLessonTypeGraded(s.lessonType);

export const isScorable = (row: SessionRosterRow, canGrade: boolean): boolean =>
  canGrade && row.residentId !== null && row.state === 'present' && !row.scoreBlockedReason;

export function draftValue(row: SessionRosterRow, edits: ScoreEdits): string {
  const edited = row.residentId === null ? undefined : edits[row.residentId];
  return edited ?? scoreText(row.score);
}

function editedScorable(rows: readonly SessionRosterRow[], edits: ScoreEdits, canGrade: boolean) {
  return rows
    .filter((r) => isScorable(r, canGrade) && r.residentId !== null && r.residentId in edits)
    .map((r) => ({ row: r, value: parseScoreText(draftValue(r, edits)) }));
}

export function invalidScoreIds(
  rows: readonly SessionRosterRow[],
  edits: ScoreEdits,
  canGrade: boolean,
): Set<string> {
  return new Set(
    editedScorable(rows, edits, canGrade)
      .filter(({ value }) => isScoreInvalid(value))
      .map(({ row }) => row.residentId as string),
  );
}

export function changedScores(
  rows: readonly SessionRosterRow[],
  edits: ScoreEdits,
  canGrade: boolean,
): SessionScoreInput[] {
  return editedScorable(rows, edits, canGrade)
    .filter(({ row, value }) => !isScoreInvalid(value) && value !== row.score)
    .map(({ row, value }) => ({ resident: row.residentId as string, score: value }));
}

export function dropSavedEdits(
  edits: ScoreEdits,
  saved: readonly SessionScoreInput[],
): ScoreEdits {
  const savedScore = new Map(saved.map((s) => [s.resident, s.score]));
  return Object.fromEntries(
    Object.entries(edits).filter(
      ([rid, text]) => !savedScore.has(rid) || parseScoreText(text) !== savedScore.get(rid),
    ),
  );
}

export function applySavedScores(
  detail: LessonSessionDetail,
  saved: readonly SessionScoreInput[],
): LessonSessionDetail {
  if (saved.length === 0) return detail;
  const savedScore = new Map(saved.map((s) => [s.resident, s.score]));
  const confirmed = (r: SessionRosterRow): SessionRosterRow =>
    r.residentId !== null && savedScore.has(r.residentId)
      ? { ...r, score: savedScore.get(r.residentId) ?? null }
      : r;
  return { ...detail, roster: detail.roster.map(confirmed) };
}

export function toInputValue(raw: string): number | null {
  const v = parseScoreText(raw);
  return v === null || Number.isNaN(v) ? null : v;
}
