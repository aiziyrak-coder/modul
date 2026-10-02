"use strict";

jest.mock("#shared/permission", () => () => (_req, _res, next) => next());
jest.mock("#shared/winston.logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("#modules/4.05-residency/_services/sessionResolution", () => ({ resolveSession: jest.fn() }));

const express = require("express");
const request = require("supertest");
const { handleError } = require("#shared/error");
const Session = require("./residencySession.model");
const Roster = require("./residencySessionRoster.model");
const Resident = require("#modules/4.05-residency/resident/resident.model");
const { resolveSession } = require("#modules/4.05-residency/_services/sessionResolution");

const OFFICE = { _id: "u-office", role: { title: "magistratura_bolim" } };
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = OFFICE;
  next();
});
app.use("/api/residency-sessions", require("./residencySessionGrade.routes"));
app.use((err, _req, res, _next) => handleError(err, res));

const SCORE_URL = `/api/residency-sessions/${"a".repeat(24)}/entries/${"b".repeat(24)}/score`;
const q = (value) => {
  const c = { select: () => c, lean: jest.fn().mockResolvedValue(value) };
  return c;
};
const sessionOf = (lessonType) => jest.spyOn(Session, "findById").mockReturnValue(q({ status: "announced", lessonType }));

beforeEach(() => {
  jest.clearAllMocks();
  resolveSession.mockResolvedValue({});
  jest.spyOn(Resident, "findById").mockReturnValue(q({ _id: "r1" }));
  jest.spyOn(Roster, "findOne").mockReturnValue(q({ _id: "f1", outcome: "pending", outcomeReason: "awaiting_close" }));
});
afterEach(() => jest.restoreAllMocks());

describe("PUT /:id/entries/:resident/score — TZ 4.5.6 (L3-Q8)", () => {
  test.each([8, null])("amaliy sessiya, score=%p — 409 lesson_type_not_graded tanasi", async (score) => {
    sessionOf("amaliy");
    const res = await request(app).put(SCORE_URL).send({ score });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      statusCode: 409,
      reason: "lesson_type_not_graded",
      message: "Amaliy mashg'ulotga har dars uchun ball qo'yilmaydi — oraliq nazorat orqali baholanadi",
    });
    expect(resolveSession).not.toHaveBeenCalled();
    expect(Resident.findById).not.toHaveBeenCalled();
  });

  test("amaliy, kalitsiz tana — validator birinchi (400), sessiya o'qilmaydi", async () => {
    const find = sessionOf("amaliy");
    expect((await request(app).put(SCORE_URL).send({})).status).toBe(400);
    expect(find).not.toHaveBeenCalled();
  });

  test("LSC-Q1=A: score 101 (yuqori chegaradan tashqari) — validator 400, sessiya o'qilmaydi, yechim chaqirilmaydi", async () => {
    const find = sessionOf("maruza");
    const res = await request(app).put(SCORE_URL).send({ score: 101 });
    expect(res.status).toBe(400);
    expect(find).not.toHaveBeenCalled();
    expect(resolveSession).not.toHaveBeenCalled();
  });

  test.each([8, 100])("maruza, score=%p — darvozadan o'tadi, TZ:515 yechimiga yetadi (stub: 409 not_confirmed)", async (score) => {
    sessionOf("maruza");
    const res = await request(app).put(SCORE_URL).send({ score });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ reason: "not_confirmed", outcome: "pending" });
    expect(resolveSession).toHaveBeenCalledTimes(1);
  });
});
