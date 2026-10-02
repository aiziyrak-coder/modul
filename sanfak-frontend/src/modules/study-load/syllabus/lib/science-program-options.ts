import type { ScienceProgram } from '../../science-program/model/types';
import type { ScienceProgramOption } from '../model/types';

export function buildScienceProgramOptions(
  items: ScienceProgram[],
): ScienceProgramOption[] {
  return items.map((sp) => {
    const isV142 = sp.formVersion === 'v142';
    return {
      value: sp.id,
      label: sp.scienceName ?? sp.id,
      isV142,
      disabled: isV142,
    };
  });
}
