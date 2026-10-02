import type { DalolatnomaItem } from './dalolatnoma-template';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function paragraphs(text: string): string {
  return text
    .split('\n')
    .map((line) => `<p>${esc(line) || '&nbsp;'}</p>`)
    .join('');
}

export interface DalolatnomaDocInput {
  heading: string[];
  intro: string;
  items: DalolatnomaItem[];
  finalConclusion: string;
}

export function buildDalolatnomaHtml(input: DalolatnomaDocInput): string {
  const { heading, intro, items, finalConclusion } = input;
  return `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="utf-8">
<title>${esc(heading[heading.length - 1] ?? 'Dalolatnoma')}</title>
<style>
  @page { size: A4; margin: 2cm 1.5cm 2cm 3cm; }
  body { font-family: "Times New Roman", serif; font-size: 14pt; line-height: 1.5; margin: 0; }
  p { margin: 0 0 6pt; text-align: justify; text-indent: 1.25cm; }
  .head { text-align: center; text-indent: 0; font-weight: bold; }
  .head-main { font-size: 16pt; letter-spacing: 0.08em; }
  .item { text-indent: 1.25cm; }
  .final { text-indent: 0; text-align: left; white-space: pre-wrap; }
</style>
</head>
<body>
${heading
    .map((line, i) =>
      `<p class="head${i === heading.length - 1 ? ' head-main' : ''}">${esc(line)}</p>`)
    .join('')}
<p>&nbsp;</p>
<p>${esc(intro)}</p>
${items.map((it) => `<p class="item">№ ${it.no}. ${esc(it.text)}</p>`).join('')}
<p>&nbsp;</p>
${paragraphs(finalConclusion).replace(/<p>/g, '<p class="final">')}
</body>
</html>`;
}

export function safeFileName(title: string): string {
  const base = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);
  return `Dalolatnoma_${base || 'ilmiy_ish'}`;
}

export function printDalolatnomaPdf(html: string, fileName: string): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.style.cssText =
    'position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;';
  frame.srcdoc = html;

  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) {
      frame.remove();
      return;
    }
    if (frame.contentDocument) frame.contentDocument.title = fileName;

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      setTimeout(() => frame.remove(), 300);
    };

    win.onafterprint = cleanup;
    win.focus();
    win.print();
    setTimeout(cleanup, 60_000);
  };

  document.body.appendChild(frame);
}
