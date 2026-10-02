const mongoose = require("mongoose");
const QualSurvey = require("#modules/4.04-qualification/_shared/qualSurvey.model");
const QualSurveyAnswer = require("#modules/4.04-qualification/_shared/qualSurveyAnswer.model");
const Service = require("#modules/4.04-qualification/qualSurvey/qualSurvey.service");

const { QUESTION_TYPES } = Service;
const oid = () => new mongoose.Types.ObjectId();

const COURSE = oid();
const LISTENER = oid();

const seedQuestions = async () => {
  const choice = await QualSurvey.create({
    question: "Kurs sifatini baholang",
    type: QUESTION_TYPES.CHOICE,
    options: [{ text: "Yaxshi" }, { text: "O'rtacha" }, { text: "Yomon" }],
    order: 1,
  });
  const rating = await QualSurvey.create({
    question: "O'qituvchiga baho (1-5)",
    type: QUESTION_TYPES.RATING,
    order: 2,
  });
  const text = await QualSurvey.create({
    question: "Takliflaringiz",
    type: QUESTION_TYPES.TEXT,
    required: false,
    order: 3,
  });
  return { choice, rating, text };
};

const fullAnswers = (q) => [
  { question: q.choice._id, optionIndex: 0 },
  { question: q.rating._id, rating: 5 },
  { question: q.text._id, text: "Rahmat" },
];

beforeEach(async () => {
  await QualSurveyAnswer.init();
});

describe("qualSurvey — to'ldirish to'sig'i", () => {
  test("kursda so'rovnoma YO'Q bo'lsa — to'siq ishlamaydi (eski kurslar buzilmasin)", async () => {
    await expect(Service.isSurveyDone(oid(), LISTENER)).resolves.toBe(true);
  });

  test("so'rovnoma BOR, topshirilmagan — to'siq yopiq", async () => {
    await seedQuestions();
    await expect(Service.isSurveyDone(COURSE, LISTENER)).resolves.toBe(false);
  });

  test("topshirilgach — to'siq ochiladi", async () => {
    const q = await seedQuestions();
    await Service.submitAnswers(COURSE, LISTENER, fullAnswers(q));
    await expect(Service.isSurveyDone(COURSE, LISTENER)).resolves.toBe(true);
  });

  test("boshqa tinglovchining javobi menikini ochmaydi", async () => {
    const q = await seedQuestions();
    await Service.submitAnswers(COURSE, oid(), fullAnswers(q));
    await expect(Service.isSurveyDone(COURSE, LISTENER)).resolves.toBe(false);
  });

  test("faol emas savol to'siqni yaratmaydi", async () => {
    await QualSurvey.create({
      question: "Eski savol",
      type: QUESTION_TYPES.TEXT,
      active: false,
    });
    await expect(Service.isSurveyDone(oid(), LISTENER)).resolves.toBe(true);
  });
});

describe("qualSurvey — javoblarni tekshirish", () => {
  test("to'liq javob qabul qilinadi va saqlanadi", async () => {
    const q = await seedQuestions();
    const doc = await Service.submitAnswers(COURSE, LISTENER, fullAnswers(q));
    expect(doc.answers).toHaveLength(3);
    expect(doc.answers[0].optionIndex).toBe(0);
    expect(doc.answers[1].rating).toBe(5);
    expect(doc.answers[2].text).toBe("Rahmat");
  });

  test("majburiy savol tashlab ketilsa — MISSING", async () => {
    const q = await seedQuestions();
    await expect(
      Service.submitAnswers(COURSE, LISTENER, [{ question: q.rating._id, rating: 3 }]),
    ).rejects.toMatchObject({ code: "MISSING" });
  });

  test("majburiy EMAS savol tashlab ketilsa — qabul qilinadi", async () => {
    const q = await seedQuestions();
    const doc = await Service.submitAnswers(COURSE, LISTENER, [
      { question: q.choice._id, optionIndex: 1 },
      { question: q.rating._id, rating: 4 },
    ]);
    expect(doc.answers).toHaveLength(2);
  });

  test("mavjud bo'lmagan variant tartibi — BAD_ANSWER", async () => {
    const q = await seedQuestions();
    await expect(
      Service.submitAnswers(COURSE, LISTENER, [
        { question: q.choice._id, optionIndex: 9 },
        { question: q.rating._id, rating: 4 },
      ]),
    ).rejects.toMatchObject({ code: "BAD_ANSWER" });
  });

  test("baho 1..5 dan tashqarida — BAD_ANSWER", async () => {
    const q = await seedQuestions();
    await expect(
      Service.submitAnswers(COURSE, LISTENER, [
        { question: q.choice._id, optionIndex: 0 },
        { question: q.rating._id, rating: 9 },
      ]),
    ).rejects.toMatchObject({ code: "BAD_ANSWER" });
  });

  test("kursda so'rovnoma yo'q — NO_SURVEY", async () => {
    await expect(Service.submitAnswers(oid(), LISTENER, [])).rejects.toMatchObject({
      code: "NO_SURVEY",
    });
  });

  test("ikkinchi marta topshirib bo'lmaydi — ALREADY", async () => {
    const q = await seedQuestions();
    await Service.submitAnswers(COURSE, LISTENER, fullAnswers(q));
    await expect(
      Service.submitAnswers(COURSE, LISTENER, fullAnswers(q)),
    ).rejects.toMatchObject({ code: "ALREADY" });
  });

  test("PARALLEL ikki marta bosilsa — bittasi o'tadi, ikkinchisi ALREADY", async () => {
    const q = await seedQuestions();
    const results = await Promise.allSettled([
      Service.submitAnswers(COURSE, LISTENER, fullAnswers(q)),
      Service.submitAnswers(COURSE, LISTENER, fullAnswers(q)),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason.code).toBe("ALREADY");
    expect(await QualSurveyAnswer.countDocuments({ course: COURSE })).toBe(1);
  });
});

describe("qualSurvey — ommaviy holat (N+1 oldini olish)", () => {
  test("surveyStatusBatch har juftlik uchun to'g'ri holat qaytaradi", async () => {
    const q = await seedQuestions();
    const otherCourse = oid();
    await Service.submitAnswers(COURSE, LISTENER, fullAnswers(q));
    const other = oid();

    const map = await Service.surveyStatusBatch([
      { course: COURSE, listener: LISTENER },
      { course: COURSE, listener: other },
      { course: otherCourse, listener: LISTENER },
    ]);

    expect(map.get(String(COURSE) + "|" + String(LISTENER))).toEqual({
      required: true,
      done: true,
    });
    expect(map.get(String(COURSE) + "|" + String(other))).toEqual({
      required: true,
      done: false,
    });
    expect(map.get(String(otherCourse) + "|" + String(LISTENER))).toEqual({
      required: true,
      done: false,
    });
  });

  test("so'rovnoma umuman kiritilmagan bo'lsa hech qaysi kurs to'silmaydi", async () => {
    const map = await Service.surveyStatusBatch([{ course: COURSE, listener: LISTENER }]);
    expect(map.get(String(COURSE) + "|" + String(LISTENER))).toEqual({
      required: false,
      done: true,
    });
  });
});
