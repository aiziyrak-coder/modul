import type { ScientificWork } from '../model/types';

export type WorkStep = 'works' | 'seminars' | 'defenses';

export function workStep(
  work: Pick<ScientificWork, 'finalDecision' | 'seminarResult'>,
): WorkStep {
  if (work.seminarResult === 'defended') return 'defenses';
  if (work.finalDecision === 'seminar') return 'seminars';
  return 'works';
}
