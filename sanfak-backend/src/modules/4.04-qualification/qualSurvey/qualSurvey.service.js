"use strict";

const QualSurvey = require("#modules/4.04-qualification/_shared/qualSurvey.model");
const QualSurveyAnswer = require("#modules/4.04-qualification/_shared/qualSurveyAnswer.model");

const { QUESTION_TYPES } = QualSurvey;

async function questionsOf({ activeOnly = true } = {}) {
  const q = activeOnly ? { active: true } : {};
  return QualSurvey.find(q).sort({ order: 1, createdAt: 1 }).lean();
}

async function hasSurvey() {
  return (await QualSurvey.countDocuments({ active: true })) > 0;
}

async function isAnswered(course, listener) {
  return (await QualSurveyAnswer.countDocuments({ course, listener })) > 0;
}

async function isSurveyDone(course, listener) {
  if (!(await hasSurvey())) return true;
  return isAnswered(course, listener);
}

async function surveyStatusBatch(pairs) {
  if (!pairs.length) return new Map();
  const courses = [...new Set(pairs.map((p) => String(p.course)))];

  const required = await hasSurvey();
  const answered = new Set(
    (
      await QualSurveyAnswer.find({
        course: { $in: courses },
        listener: { $in: [...new Set(pairs.map((p) => String(p.listener)))] },
      })
        .select("course listener")
        .lean()
    ).map((a) => String(a.course) + "|" + String(a.listener)),
  );

  const out = new Map();
  for (const p of pairs) {
    const key = String(p.course) + "|" + String(p.listener);
    out.set(key, { required, done: !required || answered.has(key) });
  }
  return out;
}

async function submitAnswers(course, listener, rawAnswers) {
  const questions = await questionsOf();
  if (!questions.length) {
    const e = new Error("So'rovnoma savollari kiritilmagan");
    e.code = "NO_SURVEY";
    throw e;
  }
  if (await isAnswered(course, listener)) {
    const e = new Error("So'rovnoma allaqachon topshirilgan");
    e.code = "ALREADY";
    throw e;
  }

  const byId = new Map(questions.map((q) => [String(q._id), q]));
  const given = new Map(
    (rawAnswers || []).map((a) => [String(a.question), a]),
  );

  const answers = [];
  for (const q of questions) {
    const a = given.get(String(q._id));
    const empty =
      !a ||
      (q.type === QUESTION_TYPES.CHOICE && a.optionIndex == null) ||
      (q.type === QUESTION_TYPES.RATING && a.rating == null) ||
      (q.type === QUESTION_TYPES.TEXT && !String(a.text || "").trim());

    if (empty) {
      if (q.required) {
        const e = new Error(`Majburiy savol to'ldirilmagan: "${q.question}"`);
        e.code = "MISSING";
        throw e;
      }
      continue;
    }

    if (q.type === QUESTION_TYPES.CHOICE) {
      const i = Number(a.optionIndex);
      if (!Number.isInteger(i) || i < 0 || i >= q.options.length) {
        const e = new Error(`Variant noto'g'ri: "${q.question}"`);
        e.code = "BAD_ANSWER";
        throw e;
      }
      answers.push({ question: q._id, optionIndex: i });
    } else if (q.type === QUESTION_TYPES.RATING) {
      const r = Number(a.rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        const e = new Error(`Baho 1..5 oralig'ida bo'lishi kerak: "${q.question}"`);
        e.code = "BAD_ANSWER";
        throw e;
      }
      answers.push({ question: q._id, rating: r });
    } else {
      answers.push({ question: q._id, text: String(a.text).trim().slice(0, 2000) });
    }
  }

  void byId;

  try {
    return await QualSurveyAnswer.create({ course, listener, answers });
  } catch (err) {
    if (err && err.code === 11000) {
      const e = new Error("So'rovnoma allaqachon topshirilgan");
      e.code = "ALREADY";
      throw e;
    }
    throw err;
  }
}

module.exports = {
  QUESTION_TYPES,
  questionsOf,
  hasSurvey,
  isAnswered,
  isSurveyDone,
  surveyStatusBatch,
  submitAnswers,
};
