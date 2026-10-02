export type DocLineKind = 'title' | 'section' | 'clause' | 'signature' | 'text' | 'space';

export interface DocLine {
  kind: DocLineKind;
  text: string;
  right?: string;
}

const UPPER_RE = /[A-ZЎҚҒҲА-Я]/;
const LOWER_RE = /[a-zўқғҳа-я]/;

const stripPlaceholders = (s: string) => s.replace(/\{\{[^}]*\}\}/g, ' ');

function isUpperish(s: string): boolean {
  const letters = stripPlaceholders(s).replace(/[^A-Za-zЎўҚқҒғҲҳА-Яа-я]/g, '');
  if (letters.length < 3) return false;
  const lower = (letters.match(new RegExp(LOWER_RE, 'g')) ?? []).length;
  return UPPER_RE.test(letters) && lower / letters.length < 0.2;
}

export function parseTemplate(body: string): DocLine[] {
  const raw = body.replace(/\r\n/g, '\n').split('\n');
  const out: DocLine[] = [];
  let titleTaken = false;

  for (const line of raw) {
    const t = line.trim();

    if (!t) {
      out.push({ kind: 'space', text: '' });
      continue;
    }

    if (!titleTaken && !/^\d+\./.test(t) && isUpperish(t)) {
      out.push({ kind: 'title', text: t });
      titleTaken = true;
      continue;
    }

    const section = /^(\d+)\.\s+(.+)$/.exec(t);
    if (section?.[2] && isUpperish(section[2])) {
      out.push({ kind: 'section', text: t });
      continue;
    }

    if (/^\d+\.\d+\./.test(t)) {
      out.push({ kind: 'clause', text: t });
      continue;
    }

    const sig = /^(.*?\S)\s{3,}(\S.*)$/.exec(line);
    if (sig?.[1] && sig[2]) {
      out.push({ kind: 'signature', text: sig[1].trim(), right: sig[2].trim() });
      continue;
    }

    out.push({ kind: 'text', text: t });
  }

  return out;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function markPlaceholders(s: string, highlight: boolean): string {
  const safe = esc(s);
  if (!highlight) return safe;
  return safe.replace(
    /\{\{\s*\w+\s*\}\}/g,
    (m) =>
      `<span style="background:#e8f7f1;color:#1a7f5a;border-radius:3px;padding:0 3px;">${m}</span>`,
  );
}

export function renderTemplateBody(body: string, highlight = false): string {
  const lines = parseTemplate(body);
  const parts: string[] = [];

  for (const l of lines) {
    const txt = markPlaceholders(l.text, highlight);
    switch (l.kind) {
      case 'title':
        parts.push(
          `<h1 style="font-size:16pt;font-weight:bold;text-align:center;margin:0 0 18px;letter-spacing:.5px;">${txt}</h1>`,
        );
        break;
      case 'section':
        parts.push(
          `<h2 style="font-size:13pt;font-weight:bold;margin:18px 0 8px;">${txt}</h2>`,
        );
        break;
      case 'clause':
        parts.push(
          `<p style="font-size:12pt;margin:0 0 6px;text-align:justify;text-indent:14px;">${txt}</p>`,
        );
        break;
      case 'signature':
        parts.push(
          `<table style="width:100%;border-collapse:collapse;margin:4px 0;"><tr>` +
            `<td style="font-size:12pt;padding:2px 0;">${txt}</td>` +
            `<td style="font-size:12pt;padding:2px 0;text-align:right;">${markPlaceholders(l.right ?? '', highlight)}</td>` +
            `</tr></table>`,
        );
        break;
      case 'space':
        parts.push('<div style="height:8px;"></div>');
        break;
      default:
        parts.push(
          `<p style="font-size:12pt;margin:0 0 6px;text-align:justify;">${txt}</p>`,
        );
    }
  }

  return parts.join('\n');
}

export function downloadTemplateDoc(body: string, fileName: string): void {
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:w="urn:schemas-microsoft-com:office:word">` +
    `<head><meta charset="utf-8">` +
    `<style>@page{size:A4;margin:20mm;} body{font-family:'Times New Roman',serif;color:#000;}</style>` +
    `</head><body>${renderTemplateBody(body, false)}</body></html>`;

  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName.replace(/\W+/g, '-')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}
