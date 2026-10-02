"use strict";

const ALLOWED_TYPES = [
  { mime: "application/pdf", ext: [".pdf"], group: "pdf", label: "PDF" },
  {
    mime: "application/msword",
    ext: [".doc"],
    group: "ole2",
    label: "Word 97-2003",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: [".docx"],
    group: "ooxml",
    label: "Word",
  },
  {
    mime: "application/vnd.ms-excel",
    ext: [".xls"],
    group: "ole2",
    label: "Excel 97-2003",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: [".xlsx"],
    group: "ooxml",
    label: "Excel",
  },
  {
    mime: "application/vnd.ms-powerpoint",
    ext: [".ppt"],
    group: "ole2",
    label: "PowerPoint 97-2003",
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ext: [".pptx"],
    group: "ooxml",
    label: "PowerPoint",
  },
  {
    mime: "application/vnd.oasis.opendocument.text",
    ext: [".odt"],
    group: "opendoc",
    label: "OpenDocument matn",
  },
  {
    mime: "application/vnd.oasis.opendocument.spreadsheet",
    ext: [".ods"],
    group: "opendoc",
    label: "OpenDocument jadval",
  },
  {
    mime: "application/vnd.oasis.opendocument.presentation",
    ext: [".odp"],
    group: "opendoc",
    label: "OpenDocument taqdimot",
  },
  { mime: "application/rtf", ext: [".rtf"], group: "rtf", label: "RTF" },
  { mime: "text/plain", ext: [".txt"], group: "text", label: "Matn" },
  { mime: "text/csv", ext: [".csv"], group: "text", label: "CSV" },

  { mime: "image/jpeg", ext: [".jpg", ".jpeg"], group: "raster", label: "JPEG" },
  { mime: "image/png", ext: [".png"], group: "raster", label: "PNG" },
  { mime: "image/webp", ext: [".webp"], group: "raster", label: "WebP" },
  { mime: "image/gif", ext: [".gif"], group: "raster", label: "GIF" },
  { mime: "image/svg+xml", ext: [".svg"], group: "svg", label: "SVG" },

  { mime: "application/zip", ext: [".zip"], group: "archive", label: "ZIP" },
  {
    mime: "application/x-rar-compressed",
    ext: [".rar"],
    group: "rar",
    label: "RAR",
  },
  {
    mime: "application/x-7z-compressed",
    ext: [".7z"],
    group: "sevenzip",
    label: "7z",
  },
];

const SIGNATURES = [
  { groups: ["pdf"], parts: [[0, "25504446"]] },
  { groups: ["ooxml", "opendoc", "archive"], parts: [[0, "504b0304"]] },
  { groups: ["ooxml", "opendoc", "archive"], parts: [[0, "504b0506"]] },
  { groups: ["ooxml", "opendoc", "archive"], parts: [[0, "504b0708"]] },
  { groups: ["ole2"], parts: [[0, "d0cf11e0a1b11ae1"]] },
  { groups: ["rtf"], parts: [[0, "7b5c727466"]] },
  { groups: ["raster"], parts: [[0, "ffd8ff"]] },
  { groups: ["raster"], parts: [[0, "89504e470d0a1a0a"]] },
  { groups: ["raster"], parts: [[0, "474946383761"]] },
  { groups: ["raster"], parts: [[0, "474946383961"]] },
  { groups: ["raster"], parts: [[0, "52494646"], [8, "57454250"]] },
  { groups: ["rar"], parts: [[0, "526172211a0700"]] },
  { groups: ["rar"], parts: [[0, "526172211a070100"]] },
  { groups: ["sevenzip"], parts: [[0, "377abcaf271c"]] },
];

const DANGEROUS_SIGNATURES = [
  { label: "Windows bajariluvchi fayl", parts: [[0, "4d5a"]] },
  { label: "ELF bajariluvchi fayl", parts: [[0, "7f454c46"]] },
  { label: "Mach-O bajariluvchi fayl", parts: [[0, "cffaedfe"]] },
  { label: "Mach-O bajariluvchi fayl", parts: [[0, "cefaedfe"]] },
  { label: "Java class", parts: [[0, "cafebabe"]] },
];

const CONTROL_BYTE = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;

const TEXT_DENY = /<\s*(script|iframe|html|\?php|!doctype)\b/i;

const EXT_INDEX = new Map();
for (const type of ALLOWED_TYPES) {
  for (const ext of type.ext) EXT_INDEX.set(ext, type);
}

const ACCEPT_EXTENSIONS = ALLOWED_TYPES.flatMap((t) => t.ext);

const ACCEPT_MIMES = ALLOWED_TYPES.map((t) => t.mime);

const matchesParts = (header, parts) =>
  parts.every(([offset, hex]) => {
    const bytes = Buffer.from(hex, "hex");
    if (header.length < offset + bytes.length) return false;
    return header.subarray(offset, offset + bytes.length).equals(bytes);
  });

const detectGroups = (header) => {
  if (!Buffer.isBuffer(header)) return [];
  const found = new Set();
  for (const sig of SIGNATURES) {
    if (matchesParts(header, sig.parts)) sig.groups.forEach((g) => found.add(g));
  }
  return [...found];
};

const detectDangerous = (header) => {
  if (!Buffer.isBuffer(header)) return null;
  const hit = DANGEROUS_SIGNATURES.find((sig) => matchesParts(header, sig.parts));
  return hit ? hit.label : null;
};

const sniffTextual = (header, group) => {
  const text = header.toString("utf8");
  if (group === "svg") {
    const head = text.slice(0, 1024).trim().replace(/^\uFEFF/, "");
    return /^<\?xml[\s\S]*|^<svg\b/i.test(head) || /<svg\b/i.test(head);
  }
  if (header.includes(0x00)) return false;
  if (CONTROL_BYTE.test(text)) return false;
  if (TEXT_DENY.test(text)) return false;
  return true;
};

const verifyContent = (ext, header) => {
  const buffer = Buffer.isBuffer(header) ? header : Buffer.alloc(0);

  const dangerous = detectDangerous(buffer);
  if (dangerous) {
    return { ok: false, code: "ATTACHMENT_TYPE_MISMATCH", detail: dangerous };
  }

  const type = EXT_INDEX.get(String(ext || "").toLowerCase());

  if (!type) return { ok: true };

  if (type.group !== "text" && type.group !== "svg") {
    const groups = detectGroups(buffer);
    if (!groups.includes(type.group)) {
      return {
        ok: false,
        code: "ATTACHMENT_TYPE_MISMATCH",
        detail: groups.length ? groups.join("/") : "noma'lum",
      };
    }
    return { ok: true, type };
  }

  if (detectGroups(buffer).length > 0) {
    return { ok: false, code: "ATTACHMENT_TYPE_MISMATCH", detail: "binar" };
  }
  if (!sniffTextual(buffer, type.group)) {
    return { ok: false, code: "ATTACHMENT_TYPE_MISMATCH", detail: type.group };
  }
  return { ok: true, type };
};

const extensionOf = (originalName) => {
  const name = String(originalName || "");
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
};

const resolveType = (originalName, header) => {
  const ext = extensionOf(originalName);

  const type = EXT_INDEX.get(ext);
  if (!type) {
    return {
      ok: false,
      code: "ATTACHMENT_TYPE_NOT_ALLOWED",
      detail: ext || "(kengaytmasiz)",
    };
  }

  const verdict = verifyContent(ext, header);
  if (!verdict.ok) return verdict;

  return { ok: true, type, ext };
};

module.exports = {
  ALLOWED_TYPES,
  ACCEPT_EXTENSIONS,
  ACCEPT_MIMES,
  detectGroups,
  detectDangerous,
  extensionOf,
  verifyContent,
  resolveType,
};
