"use strict";

const { ErrorHandler } = require("#shared/error");
const QualSurvey = require("#modules/4.04-qualification/_shared/qualSurvey.model");
const QualSurveyAnswer = require("#modules/4.04-qualification/_shared/qualSurveyAnswer.model");
const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const { getListenerId } = require("#modules/4.04-qualification/_shared/listenerContext");
const Service = require("./qualSurvey.service");

const STATUS_BY_CODE = {
  NO_SURVEY: 404,
  ALREADY: 409,
  MISSING: 400,
  BAD_ANSWER: 400,
};

module.exports = {
  findAll: async (req, res, next) => {
    try {
      const query = {};
      const docs = await QualSurvey.find(query)
        .sort({ order: 1, createdAt: 1 })
        .lean();
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "So'rovnoma savollari olinmadi", err.message));
    }
  },

  paginate: async (req, res, next) => {
    try {
      const query = {};
      const docs = await QualSurvey.paginate(query, {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 10,
        sort: { order: 1, createdAt: 1 },
      });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "So'rovnoma savollari olinmadi", err.message));
    }
  },

  create: async (req, res, next) => {
    try {
      return res.status(201).json(await QualSurvey.create(req.body));
    } catch (err) {
      return next(new ErrorHandler(400, "Savol qo'shilmadi", err.message));
    }
  },

  bulkCreate: async (req, res, next) => {
    try {
      const { items } = req.body;
      const base = await QualSurvey.countDocuments();
      const docs = await QualSurvey.insertMany(
        items.map((it, i) => ({ ...it, order: it.order ?? base + i })),
      );
      return res.status(201).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Savollar qo'shilmadi", err.message));
    }
  },

  update: async (req, res, next) => {
    try {
      const doc = await QualSurvey.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!doc) return next(new ErrorHandler(404, "Savol topilmadi"));
      return res.status(200).json(doc);
    } catch (err) {
      return next(new ErrorHandler(400, "Savol yangilanmadi", err.message));
    }
  },

  remove: async (req, res, next) => {
    try {
      const doc = await QualSurvey.findByIdAndDelete(req.params.id);
      if (!doc) return next(new ErrorHandler(404, "Savol topilmadi"));
      return res.status(200).json({ message: "O'chirildi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Savol o'chirilmadi", err.message));
    }
  },

  reorder: async (req, res, next) => {
    try {
      const ops = req.body.map((it) => ({
        updateOne: { filter: { _id: it._id }, update: { $set: { order: it.order } } },
      }));
      await QualSurvey.bulkWrite(ops);
      return res.status(200).json({ message: "Tartib yangilandi" });
    } catch (err) {
      return next(new ErrorHandler(400, "Tartib yangilanmadi", err.message));
    }
  },

  mySurvey: async (req, res, next) => {
    try {
      const { course } = req.query;
      if (!course) return next(new ErrorHandler(400, "course majburiy"));
      const listener = await getListenerId(req);
      if (!listener) return next(new ErrorHandler(403, "Tinglovchi aniqlanmadi"));

      const questions = await Service.questionsOf();
      return res.status(200).json({
        required: questions.length > 0,
        submitted: await Service.isAnswered(course, listener),
        questions,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "So'rovnoma olinmadi", err.message));
    }
  },

  submit: async (req, res, next) => {
    try {
      const { course, answers } = req.body;
      const listener = await getListenerId(req);
      if (!listener) return next(new ErrorHandler(403, "Tinglovchi aniqlanmadi"));

      const doc = await Service.submitAnswers(course, listener, answers);
      return res.status(201).json({ message: "So'rovnoma qabul qilindi", _id: doc._id });
    } catch (err) {
      const status = STATUS_BY_CODE[err.code];
      if (status) return next(new ErrorHandler(status, err.message));
      return next(new ErrorHandler(400, "So'rovnoma topshirilmadi", err.message));
    }
  },

  answersPaginate: async (req, res, next) => {
    try {
      const query = {};
      if (req.query.course) query.course = req.query.course;
      const docs = await QualSurveyAnswer.paginate(query, {
        page: parseInt(req.query.page, 10) || 1,
        limit: parseInt(req.query.limit, 10) || 10,
        sort: { createdAt: -1 },
        populate: [
          { path: "listener", model: "QualListener", select: "fullName" },
          { path: "course", select: "title" },
          { path: "answers.question", model: "qualSurvey", select: "question type options order" },
        ],
      });
      return res.status(200).json(docs);
    } catch (err) {
      return next(new ErrorHandler(400, "Javoblar olinmadi", err.message));
    }
  },

  answersSummary: async (req, res, next) => {
    try {
      const { course } = req.query;
      const scope = course ? { course } : {};

      const questions = await Service.questionsOf({ activeOnly: false });
      const submissions = await QualSurveyAnswer.find(scope)
        .populate({ path: "listener", model: "QualListener", select: "fullName" })
        .lean();

      const byQuestion = new Map(questions.map((q) => [String(q._id), []]));
      for (const s of submissions) {
        for (const a of s.answers || []) {
          const list = byQuestion.get(String(a.question));
          if (list) list.push({ ...a, listener: s.listener });
        }
      }

      const { QUESTION_TYPES } = Service;
      const result = questions.map((q) => {
        const given = byQuestion.get(String(q._id)) || [];
        if (q.type === QUESTION_TYPES.CHOICE) {
          const counts = q.options.map((o, i) => ({
            text: o.text,
            count: given.filter((g) => g.optionIndex === i).length,
          }));
          return { _id: q._id, question: q.question, type: q.type, total: given.length, counts };
        }
        if (q.type === QUESTION_TYPES.RATING) {
          const nums = given.map((g) => g.rating).filter((n) => typeof n === "number");
          const avg = nums.length
            ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
            : null;
          return { _id: q._id, question: q.question, type: q.type, total: nums.length, average: avg };
        }
        return {
          _id: q._id,
          question: q.question,
          type: q.type,
          total: given.length,
          texts: given.map((g) => ({
            text: g.text,
            listener: g.listener ? g.listener.fullName : null,
          })),
        };
      });

      return res.status(200).json({
        submissions: submissions.length,
        questions: result,
      });
    } catch (err) {
      return next(new ErrorHandler(400, "Natija olinmadi", err.message));
    }
  },

  answersStatus: async (req, res, next) => {
    try {
      const { course } = req.query;
      const scope = course ? { course } : {};

      const done = await QualSurveyAnswer.find(scope)
        .select("listener createdAt")
        .sort({ createdAt: -1 })
        .lean();
      const doneMap = new Map();
      for (const d of done) {
        if (!doneMap.has(String(d.listener))) doneMap.set(String(d.listener), d.createdAt);
      }
      const listeners = await QualListener.find({ _id: { $in: [...doneMap.keys()] } })
        .select("fullName")
        .lean();

      return res.status(200).json(
        listeners.map((l) => ({
          _id: l._id,
          fullName: l.fullName,
          submittedAt: doneMap.get(String(l._id)) || null,
        })),
      );
    } catch (err) {
      return next(new ErrorHandler(400, "Holat olinmadi", err.message));
    }
  },
};
