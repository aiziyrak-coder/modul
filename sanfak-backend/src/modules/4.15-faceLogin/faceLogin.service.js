const winston = require("#shared/winston.logger");
const { ErrorHandler } = require("#shared/error");
const FaceTemplate = require("./faceTemplate.model");

const EMBEDDING_DIM = 512;
// Qaror qoidasi (davomatdan QATTIQROQ): ketma-ket kadrlarning HAMMASIDA bitta odam chiqishi,
// o'xshashlik >= THRESHOLD va eng yaqin BOSHQA odamdan kamida MARGIN uzoq bo'lishi shart.
const THRESHOLD = () => Number(process.env.FACE_MATCH_THRESHOLD) || 0.52;
const MARGIN = () => Number(process.env.FACE_MATCH_MARGIN) || 0.07;
const CACHE_TTL_MS = 60_000;

const normalize = (arr) => {
  let n = 0;
  for (const x of arr) n += x * x;
  n = Math.sqrt(n);
  if (!Number.isFinite(n) || n === 0) return null;
  return Float32Array.from(arr, (x) => x / n);
};

let cache = { at: 0, items: null };

async function loadTemplates() {
  if (cache.items && Date.now() - cache.at < CACHE_TTL_MS) return cache.items;
  const rows = await FaceTemplate.find({ active: true }).select("+embedding user camPersonId").lean();
  const items = [];
  for (const r of rows) {
    if (!Array.isArray(r.embedding) || r.embedding.length !== EMBEDDING_DIM) continue;
    const vec = normalize(r.embedding);
    if (vec) items.push({ id: String(r.camPersonId), user: r.user ? String(r.user) : null, vec });
  }
  cache = { at: Date.now(), items };
  return items;
}
const invalidateCache = () => {
  cache = { at: 0, items: null };
};

// rasm -> embedding. Yuz yo'q/kichik bo'lsa null.
async function embedImage(buffer) {
  const base = process.env.FACE_API_URL;
  if (!base) throw new ErrorHandler(503, "Yuz bilan kirish sozlanmagan");
  const form = new FormData();
  form.append("image", new Blob([buffer], { type: "image/jpeg" }), "frame.jpg");
  let res;
  try {
    res = await fetch(`${base.replace(/\/+$/, "")}/embed`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    winston.error(`[faceLogin] yuz xizmati javob bermadi: ${e.message}`);
    throw new ErrorHandler(503, "Yuz xizmati vaqtincha ishlamayapti");
  }
  if (res.status === 413 || res.status === 422) return null;
  if (!res.ok) throw new ErrorHandler(503, "Yuz xizmati xatosi");
  const body = await res.json();
  const emb = body?.embedding;
  return Array.isArray(emb) && emb.length === EMBEDDING_DIM ? emb : null;
}

// embeddings: har kadr uchun (yoki null). Natija: {status: ok|no_face|unknown|unlinked, user, similarity}
function decide(embeddings, items) {
  if (!embeddings.length || embeddings.some((e) => e === null)) return { status: "no_face" };
  if (!items.length) return { status: "unknown" };

  const picked = new Set();
  const bestFor = new Map(); // identity -> user
  let worst = 1;
  for (const emb of embeddings) {
    const vec = normalize(emb);
    if (!vec) return { status: "no_face" };
    // "odam" = bog'langan hisob yoki bog'lanmagan shablon (bir odamning ikki yuzi raqib bo'lmasin)
    const perIdentity = new Map(); // identity -> {sim, user}
    for (const t of items) {
      let dot = 0;
      for (let i = 0; i < EMBEDDING_DIM; i++) dot += vec[i] * t.vec[i];
      const identity = t.user || `tpl:${t.id}`;
      const cur = perIdentity.get(identity);
      if (!cur || dot > cur.sim) perIdentity.set(identity, { sim: dot, user: t.user });
    }
    const ranked = [...perIdentity.entries()].sort((a, b) => b[1].sim - a[1].sim);
    const [bestIdentity, best] = ranked[0];
    const second = ranked.length > 1 ? ranked[1][1].sim : -1;
    if (best.sim < THRESHOLD() || best.sim - second < MARGIN()) {
      return { status: "unknown", similarity: best.sim };
    }
    picked.add(bestIdentity);
    bestFor.set(bestIdentity, best.user);
    worst = Math.min(worst, best.sim);
  }
  if (picked.size !== 1) return { status: "unknown", similarity: worst };
  const user = bestFor.get([...picked][0]);
  return user ? { status: "ok", user, similarity: worst } : { status: "unlinked", similarity: worst };
}

async function identify(frames) {
  const embeddings = await Promise.all(frames.map(embedImage));
  const items = await loadTemplates();
  const decision = decide(embeddings, items);
  winston.info(
    `[faceLogin] status=${decision.status} sim=${(decision.similarity ?? 0).toFixed(3)}`,
  );
  return decision;
}

module.exports = { identify, decide, invalidateCache, THRESHOLD, MARGIN };
