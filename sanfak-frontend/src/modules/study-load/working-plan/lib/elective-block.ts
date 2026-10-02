const ELECTIVE_TITLE_RX = /tanlov/i;
const MANDATORY_TITLE_RX = /majburiy/i;

const GENERATED_CODE_RX = /^BLK0*(\d+)$/;

const ELECTIVE_BLOCK_NUMBER = 2;

export const MAX_ALTERNATIVES = 2;

export interface ElectiveBlockInput {
  blockCode?: string | null;
  title?: string | null;
}

export function isElectiveBlock(block: ElectiveBlockInput | null | undefined): boolean {
  if (!block) return false;

  const title = (block.title ?? '').trim();
  if (title) {
    if (ELECTIVE_TITLE_RX.test(title)) return true;
    if (MANDATORY_TITLE_RX.test(title)) return false;
  }

  const code = (block.blockCode ?? '').trim().toUpperCase();
  if (!code) return false;

  const generated = GENERATED_CODE_RX.exec(code);
  if (generated) return Number(generated[1]) === ELECTIVE_BLOCK_NUMBER;

  return code.startsWith('T');
}
