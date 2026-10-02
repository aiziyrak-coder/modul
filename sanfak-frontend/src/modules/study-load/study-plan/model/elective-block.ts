import type { StudyPlanPlan } from '../api/detail-api';

type PlanBlock = StudyPlanPlan['blocks'][number];

const ELECTIVE_TITLE_RX = /tanlov/i;
const MANDATORY_TITLE_RX = /majburiy/i;
const PRACTICE_TITLE_RX = /amaliyot|attestat/i;
const GENERATED_CODE_RX = /^BLK0*(\d+)$/;
const ELECTIVE_BLOCK_NUMBER = 2;

export const MAX_ALTERNATIVES = 2;

export function isElectiveBlock(block: Pick<PlanBlock, 'blockCode' | 'title'>): boolean {
  const title = (block.title ?? '').trim();
  if (title) {
    if (ELECTIVE_TITLE_RX.test(title)) return true;
    if (MANDATORY_TITLE_RX.test(title)) return false;
    if (PRACTICE_TITLE_RX.test(title)) return false;
  }

  const code = (block.blockCode ?? '').trim().toUpperCase();
  if (!code) return false;

  const generated = GENERATED_CODE_RX.exec(code);
  if (generated) return Number(generated[1]) === ELECTIVE_BLOCK_NUMBER;

  return code.startsWith('T');
}

export type BlockFreeQuota = Record<string, { hour: number; credit: number }>;

export function computeBlockFreeQuota(block: PlanBlock): BlockFreeQuota {
  const used: Record<string, { hour: number; credit: number }> = {};
  for (const sci of block.sciences) {
    if (sci.kind === 'aggregate' || sci.kind === 'sectionHeader') continue;
    for (const [semKey, sem] of Object.entries(sci.semesters)) {
      const acc = used[semKey] ?? { hour: 0, credit: 0 };
      acc.hour += sem.hour;
      acc.credit += sem.credit;
      used[semKey] = acc;
    }
  }

  const free: BlockFreeQuota = {};
  for (const [semKey, quota] of Object.entries(block.semesters)) {
    const usedAtSem = used[semKey] ?? { hour: 0, credit: 0 };
    free[semKey] = {
      hour: quota.hour - usedAtSem.hour,
      credit: quota.credit - usedAtSem.credit,
    };
  }
  return free;
}

export function hasFreeQuota(free: BlockFreeQuota): boolean {
  return Object.values(free).some((q) => q.hour > 0 || q.credit > 0);
}
