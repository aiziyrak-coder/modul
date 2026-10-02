function getSemester(sci, semNum) {
  const sems = sci.semesters;
  if (!sems) return null;
  const key = String(semNum);
  if (typeof sems.get === "function") return sems.get(key);
  return sems[key];
}

function resolveWeeklyHours(sem) {
  const explicit = Number(sem?.weeklyHours) || 0;
  if (explicit > 0) return explicit;
  return Number(sem?.hour) || 0;
}

function semTotalHour(particles) {
  const hit = (particles || []).find((p) => p?.canonical === "total");
  return Number(hit?.value) || 0;
}

function getActiveSemesters(sci) {
  const sems = sci.semesters;
  if (!sems) return [];
  const entries =
    typeof sems.entries === "function"
      ? Array.from(sems.entries())
      : Object.entries(sems);
  return entries
    .filter(([, v]) => v && (Number(v.hour) > 0 || Number(v.credit) > 0))
    .map(([k]) => k);
}

function scaleParticles(particles, ratio) {
  if (!Array.isArray(particles)) return [];
  return particles.map((p) => ({
    slug: p.slug,
    title: p.title,
    value: Math.round((Number(p.value) || 0) * ratio),
    canonical: p.canonical || null,
    colNum: p.colNum != null ? p.colNum : null,
  }));
}

function buildSemesterTable(plan, semNum) {
  const semKey = String(semNum);
  const fans = [];

  for (const block of plan.blocks || []) {
    for (const sci of block.sciences || []) {
      const sem = getSemester(sci, semKey);
      if (!sem) continue;

      const semHour = Number(sem.hour) || 0;
      const semCredit = Number(sem.credit) || 0;
      if (semHour === 0 && semCredit === 0) continue;

      let particles = [];
      let isExact = false;

      if (Array.isArray(sem.particles) && sem.particles.length > 0) {
        particles = sem.particles.map((p) => ({
          slug: p.slug,
          title: p.title,
          value: Number(p.value) || 0,
          canonical: p.canonical || null,
          colNum: p.colNum != null ? p.colNum : null,
        }));
        isExact = true;
      } else if (Array.isArray(sci.particle) && sci.particle.length > 0) {
        const activeSems = getActiveSemesters(sci);
        if (activeSems.length === 1) {
          particles = sci.particle.map((p) => ({
            slug: p.slug,
            title: p.title,
            value: Number(p.value) || 0,
            canonical: p.canonical || null,
            colNum: p.colNum != null ? p.colNum : null,
          }));
          isExact = true;
        } else {
          const totalHour = activeSems.reduce(
            (s, k) => s + (Number(getSemester(sci, k)?.hour) || 0),
            0,
          );
          const ratio = totalHour > 0 ? semHour / totalHour : 0;
          particles = scaleParticles(sci.particle, ratio);
          isExact = false;
        }
      }

      fans.push({
        _id: sci._id,
        serialNumber: sci.serialNumber,
        code: sci.code,
        title: sci.title,
        science: sci.science,
        department: sci.department,
        block: block.blockCode,
        blockTitle: block.title,
        totalHour: semTotalHour(particles) || semHour,
        credit: semCredit,
        weeklyHours: resolveWeeklyHours(sem),
        assessmentType: sem.assessmentType || null,
        particles,
        isExact,
      });
    }
  }

  const totals = {
    jamiHour: fans.reduce((s, f) => s + (f.totalHour || 0), 0),
    jamiCredit: fans.reduce((s, f) => s + (f.credit || 0), 0),
    fanlarSoni: fans.length,
  };

  return {
    semester: semKey,
    fans,
    totals,
  };
}

function buildBlocksTable(plan) {
  const blocks = [];
  let jamiKredit = 0;
  let jamiFanlar = 0;
  const byBlockCredit = {};

  for (const block of plan.blocks || []) {
    const fans = (block.sciences || []).map((sci) => ({
      _id: sci._id,
      serialNumber: sci.serialNumber,
      code: sci.code,
      title: sci.title,
      science: sci.science,
      department: sci.department,
      totalCredit: Number(sci.totalCredit) || 0,
    }));

    const blockCredit =
      Number(block.totalCredit) ||
      fans.reduce((s, f) => s + (f.totalCredit || 0), 0);

    blocks.push({
      _id: block._id,
      blockCode: block.blockCode,
      serialNumber: block.serialNumber,
      code: block.code,
      title: block.title,
      totalCredit: blockCredit,
      fanlarSoni: fans.length,
      fans,
    });

    if (block.title) byBlockCredit[block.title] = blockCredit;
    jamiKredit += blockCredit;
    jamiFanlar += fans.length;
  }

  return {
    blocks,
    totals: {
      byBlock: byBlockCredit,
      jamiKredit,
      jamiFanlar,
    },
  };
}

function sumParticlesByHeader(fans, headerItems) {
  const sums = {};
  for (const f of fans) {
    for (const p of f.particles || []) {
      if (!p?.slug) continue;
      sums[p.slug] = (sums[p.slug] || 0) + (Number(p.value) || 0);
    }
  }
  return (headerItems || []).map((h) => ({
    slug: h.slug,
    title: h.title,
    colNum: h.colNum,
    value: sums[h.slug] || 0,
  }));
}

const PRACTICE_RE = /malakaviy\s*amaliyot|amaliyot/i;
function isPracticeRow(sci) {
  if (!sci) return false;
  const t = String(sci.title || "").trim();
  return PRACTICE_RE.test(t);
}

function buildSemestersBlocksTable(plan, semNumbers = null) {
  const headerItems = plan?.meta?.particles?.items || [];
  const headers = headerItems.map((h) => ({
    slug: h.slug,
    title: h.title,
    colNum: h.colNum,
  }));

  const sems =
    semNumbers ||
    (plan?.meta?.distribution?.semester || []).map(String) ||
    ["1", "2"];

  const semesters = sems.map((semKey) => {
    const blocksOut = [];
    let practiceRow = null;

    for (const block of plan.blocks || []) {
      const fansInBlock = [];

      for (const sci of block.sciences || []) {
        const sem = getSemester(sci, semKey);
        if (!sem) continue;
        const semHour = Number(sem.hour) || 0;
        const semCredit = Number(sem.credit) || 0;
        if (semHour === 0 && semCredit === 0) continue;

        let particles = [];
        let isExact = false;
        if (Array.isArray(sem.particles) && sem.particles.length > 0) {
          particles = sem.particles.map((p) => ({
            slug: p.slug,
            title: p.title,
            value: Number(p.value) || 0,
          }));
          isExact = true;
        } else if (Array.isArray(sci.particle) && sci.particle.length > 0) {
          const active = getActiveSemesters(sci);
          if (active.length === 1) {
            particles = sci.particle.map((p) => ({
              slug: p.slug,
              title: p.title,
              value: Number(p.value) || 0,
            }));
            isExact = true;
          } else {
            const totalHour = active.reduce(
              (s, k) => s + (Number(getSemester(sci, k)?.hour) || 0),
              0,
            );
            const ratio = totalHour > 0 ? semHour / totalHour : 0;
            particles = scaleParticles(sci.particle, ratio).map((p) => ({
              slug: p.slug,
              title: p.title,
              value: p.value,
            }));
            isExact = false;
          }
        }

        const fanRow = {
          _id: sci._id,
          code: sci.code,
          title: sci.title,
          science: sci.science,
          department: sci.department,
          particles,
          weeklyHours: resolveWeeklyHours(sem),
          credit: semCredit,
          evaluationType: sem.assessmentType || sci.evaluationType || null,
          isExact,
        };

        if (isPracticeRow(sci)) {
          practiceRow = fanRow;
        } else {
          fansInBlock.push(fanRow);
        }
      }

      if (fansInBlock.length === 0) continue;

      blocksOut.push({
        _id: block._id,
        blockCode: block.blockCode,
        title: block.title,
        fans: fansInBlock,
        jami: sumParticlesByHeader(fansInBlock, headerItems),
      });
    }

    const allFans = [
      ...blocksOut.flatMap((b) => b.fans),
      ...(practiceRow ? [practiceRow] : []),
    ];

    return {
      semester: semKey,
      blocks: blocksOut,
      malakaviyAmaliyot: practiceRow,
      jamiSemestrda: sumParticlesByHeader(allFans, headerItems),
    };
  });

  return {
    headers,
    semesters,
  };
}

module.exports = {
  buildSemesterTable,
  buildBlocksTable,
  buildSemestersBlocksTable,
  getSemester,
  getActiveSemesters,
  scaleParticles,
  resolveWeeklyHours,
};
