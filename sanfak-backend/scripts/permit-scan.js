"use strict";

const { MODULES, ACTIONS } = require("../src/config/constants");

const MODULE_KEYS = new Set(Object.keys(MODULES));
const ACTION_KEYS = new Set(Object.keys(ACTIONS));

const DEFAULT_ACTIONS = [
  ACTIONS.CREATE,
  ACTIONS.READ,
  ACTIONS.READ_ALL,
  ACTIONS.UPDATE,
  ACTIONS.DELETE,
];

const OPERAND_END = /[A-Za-z0-9_$)\]]/;
const KEYWORDS_BEFORE_REGEX = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "case",
  "do",
  "else",
  "yield",
  "await",
]);

function isRegexStart(src, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(src[j])) j--;
  if (j < 0) return true;
  const c = src[j];
  if (!OPERAND_END.test(c)) return true;
  if (/[A-Za-z0-9_$]/.test(c)) {
    let k = j;
    while (k >= 0 && /[A-Za-z0-9_$]/.test(src[k])) k--;
    return KEYWORDS_BEFORE_REGEX.has(src.slice(k + 1, j + 1));
  }
  return false;
}

function endOfQuoted(src, i) {
  const quote = src[i];
  for (let j = i + 1; j < src.length; j++) {
    if (src[j] === "\\") {
      j++;
      continue;
    }
    if (src[j] === quote) return j + 1;
    if (src[j] === "\n") return j;
  }
  return src.length;
}

function endOfTemplate(src, i) {
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") {
      j++;
      continue;
    }
    if (c === "`") return j + 1;
    if (c === "$" && src[j + 1] === "{") {
      let depth = 1;
      j += 2;
      while (j < src.length && depth > 0) {
        const d = src[j];
        if (d === "\\") {
          j += 2;
          continue;
        }
        if (d === "{") depth++;
        else if (d === "}") depth--;
        else if (d === "`") {
          j = endOfTemplate(src, j);
          continue;
        } else if (d === "'" || d === '"') {
          j = endOfQuoted(src, j);
          continue;
        }
        j++;
      }
      j--;
      continue;
    }
  }
  return src.length;
}

function maskNonCode(src) {
  const buf = src.split("");
  const regions = [];
  const blank = (from, to, kind) => {
    for (let k = from; k < to && k < buf.length; k++) {
      if (buf[k] !== "\n" && buf[k] !== "\r") buf[k] = " ";
    }
    regions.push({ start: from, end: Math.min(to, src.length), kind });
  };

  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const c2 = src[i + 1];
    if (c === "/" && c2 === "/") {
      let j = i;
      while (j < src.length && src[j] !== "\n") j++;
      blank(i, j, "line-comment");
      i = j;
      continue;
    }
    if (c === "/" && c2 === "*") {
      const e = src.indexOf("*/", i + 2);
      const j = e === -1 ? src.length : e + 2;
      blank(i, j, "block-comment");
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      const j = endOfQuoted(src, i);
      blank(i, j, "string");
      i = j;
      continue;
    }
    if (c === "`") {
      const j = endOfTemplate(src, i);
      blank(i, j, "template");
      i = j;
      continue;
    }
    if (c === "/" && isRegexStart(src, i)) {
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < src.length) {
        const d = src[j];
        if (d === "\\") {
          j += 2;
          continue;
        }
        if (d === "\n") break;
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) {
          j++;
          closed = true;
          break;
        }
        j++;
      }
      if (closed) {
        while (j < src.length && /[dgimsuvy]/.test(src[j])) j++;
        blank(i, j, "regex");
        i = j;
        continue;
      }
    }
    i++;
  }

  return { code: buf.join(""), regions };
}

const lineOf = (src, index) => src.slice(0, index).split("\n").length;

function readCallArgs(code, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < code.length; i++) {
    const c = code[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      depth--;
      if (depth === 0) return { argsText: code.slice(openIndex + 1, i), end: i };
    }
  }
  return null;
}

function splitTopLevel(argsText) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < argsText.length; i++) {
    const c = argsText[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) {
      parts.push(argsText.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(argsText.slice(start));
  const out = parts.map((s) => s.trim());
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

function findPermitCalls(code) {
  const calls = [];
  const RX = /permit\s*\(/g;
  let m;
  while ((m = RX.exec(code))) {
    const prev = m.index === 0 ? "" : code[m.index - 1];
    if (prev && /[A-Za-z0-9_$.]/.test(prev)) continue;
    const open = code.indexOf("(", m.index);
    const parsed = readCallArgs(code, open);
    if (!parsed) {
      calls.push({ index: m.index, broken: true, args: [] });
      continue;
    }
    calls.push({ index: m.index, args: splitTopLevel(parsed.argsText) });
    RX.lastIndex = parsed.end;
  }
  return calls;
}

function collectModuleAliases(code) {
  const map = new Map();
  const conflicts = [];
  const RX =
    /(?:^|[\n;{)}])\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*MODULES\.([A-Z0-9_]+)\s*[;\n]/g;
  let m;
  while ((m = RX.exec(code))) {
    const id = m[1];
    const key = m[2];
    if (map.has(id) && map.get(id) !== key) conflicts.push({ id, keys: [map.get(id), key] });
    map.set(id, key);
  }
  return { map, conflicts };
}

function collectFactoryKeys(callerCode, paramName) {
  const found = new Set();
  const RX = new RegExp(`\\b${paramName}\\s*:\\s*MODULES\\.([A-Z0-9_]+)\\b`, "g");
  let m;
  while ((m = RX.exec(callerCode))) found.add(m[1]);
  return found;
}

function scanFiles(entries, callersOf = new Map()) {
  const prepared = new Map();
  for (const e of entries) {
    const masked = maskNonCode(e.text);
    prepared.set(e.file, {
      raw: e.text,
      code: masked.code,
      regions: masked.regions,
      aliases: collectModuleAliases(masked.code),
    });
  }

  const requirements = new Map();
  const unresolved = [];
  const warnings = [];
  const stats = {
    rawOccurrences: 0,
    inNonCode: 0,
    nonCodeByKind: {},
    codeCalls: 0,
    literal: 0,
    alias: 0,
    factory: 0,
    noActionArray: 0,
  };

  const need = (section, action, where) => {
    const k = `${section}:${action}`;
    if (!requirements.has(k)) requirements.set(k, new Set());
    requirements.get(k).add(where);
  };

  for (const { file } of entries) {
    const p = prepared.get(file);

    for (const c of p.aliases.conflicts) {
      warnings.push(`${file}: "${c.id}" aliasi ikki xil kalitga bog'langan (${c.keys.join(" / ")})`);
    }

    for (const m of p.raw.matchAll(/permit\s*\(/g)) {
      const prev = m.index === 0 ? "" : p.raw[m.index - 1];
      if (prev && /[A-Za-z0-9_$.]/.test(prev)) continue;
      stats.rawOccurrences++;
      const region = p.regions.find((r) => m.index >= r.start && m.index < r.end);
      if (region) {
        stats.inNonCode++;
        stats.nonCodeByKind[region.kind] = (stats.nonCodeByKind[region.kind] || 0) + 1;
      }
    }

    for (const call of findPermitCalls(p.code)) {
      stats.codeCalls++;
      const where = `${file}:${lineOf(p.raw, call.index)}`;

      if (call.broken) {
        unresolved.push({ where, reason: "yopilmagan qavs", text: "" });
        continue;
      }

      const arg0 = call.args[0] || "";
      const arg1 = call.args[1];

      let actions;
      if (arg1 !== undefined && arg1 !== "") {
        const names = [...arg1.matchAll(/ACTIONS\.([A-Z0-9_]+)/g)].map((x) => x[1]);
        const unknown = names.filter((k) => !ACTION_KEYS.has(k));
        if (unknown.length) {
          unresolved.push({
            where,
            reason: `ACTIONS da yo'q kalit: ${unknown.join(", ")}`,
            text: arg1,
          });
        }
        actions = names.filter((k) => ACTION_KEYS.has(k)).map((k) => ACTIONS[k]);
        if (!actions.length) {
          unresolved.push({ where, reason: "2-argument ACTIONS.* bermadi", text: arg1 });
          continue;
        }
      } else {
        stats.noActionArray++;
        actions = DEFAULT_ACTIONS;
      }

      let keys = null;
      const literal = arg0.match(/^MODULES\.([A-Z0-9_]+)$/);
      if (literal) {
        keys = [literal[1]];
        stats.literal++;
      } else if (/^[A-Za-z_$][\w$]*$/.test(arg0) && p.aliases.map.has(arg0)) {
        keys = [p.aliases.map.get(arg0)];
        stats.alias++;
      } else if (/^[A-Za-z_$][\w$]*$/.test(arg0)) {
        const found = new Set();
        for (const caller of callersOf.get(file) || []) {
          const cc = prepared.get(caller);
          if (!cc) continue;
          for (const key of collectFactoryKeys(cc.code, arg0)) found.add(key);
        }
        if (found.size) {
          keys = [...found];
          stats.factory++;
        }
      }

      if (!keys) {
        unresolved.push({ where, reason: "1-argument MODULES kalitiga yechilmadi", text: arg0 });
        continue;
      }
      for (const key of keys) {
        if (!MODULE_KEYS.has(key)) {
          unresolved.push({ where, reason: `MODULES da yo'q kalit: ${key}`, text: arg0 });
          continue;
        }
        for (const a of actions) need(MODULES[key], a, where);
      }
    }
  }

  return { requirements, unresolved, warnings, stats };
}

module.exports = {
  maskNonCode,
  isRegexStart,
  lineOf,
  readCallArgs,
  splitTopLevel,
  findPermitCalls,
  collectModuleAliases,
  collectFactoryKeys,
  scanFiles,
  DEFAULT_ACTIONS,
};
