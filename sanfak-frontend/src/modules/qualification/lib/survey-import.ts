import { SURVEY_TYPE } from '../model/survey.types';
import type { SurveyType } from '../model/survey.types';

export interface ParsedSurveyQuestion {
  question: string;
  type: SurveyType;
  options: { text: string }[];
}

function splitOptions(line: string): string[] {
  const out: string[] = [];
  const re = /([A-Z])\)\s*([^]*?)(?=(?:\s{2,}|\t)[A-Z]\)|$)/g;
  let m = re.exec(line);
  while (m) {
    const text = (m[2] ?? '').replace(/\s+/g, ' ').trim();
    if (text) out.push(text);
    m = re.exec(line);
  }
  return out;
}

const isOptionLine = (line: string) => /^[A-Z]\)\s*\S/.test(line.trim());

const questionNumber = (line: string): string | null => {
  const m = /^(\d{1,3})[.)]\s+(.*)$/.exec(line.trim());
  return m ? (m[2] ?? '').trim() : null;
};

export function parseSurveyText(text: string): ParsedSurveyQuestion[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: ParsedSurveyQuestion[] = [];
  let current: ParsedSurveyQuestion | null = null;

  const flush = () => {
    if (!current) return;
    const q = current.question.trim();
    if (q) {
      if (current.options.length >= 2) {
        out.push({ ...current, type: SURVEY_TYPE.CHOICE });
      } else {
        out.push({ question: q, type: SURVEY_TYPE.TEXT, options: [] });
      }
    }
    current = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/[\u00a0\u2007\u202f]/g, ' ').trim();
    if (!line) continue;

    const qText = questionNumber(line);
    if (qText !== null) {
      flush();
      current = {
        question: qText.replace(/\s*\((?:erkin javob|ixtiyoriy|ro['‘’]?yxatdan[^)]*)\)\s*$/i, '').trim(),
        type: SURVEY_TYPE.CHOICE,
        options: [],
      };
      continue;
    }

    if (current && isOptionLine(line)) {
      current.options.push(...splitOptions(line).map((t) => ({ text: t })));
      continue;
    }
  }
  flush();

  return out;
}
