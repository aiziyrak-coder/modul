jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#modules/4.04-qualification/_shared/qualListener.model");
jest.mock("#modules/4.04-qualification/qualPetition/qualPetition.model");

const User = require("#modules/4.01-auth/user/user.model");
const QualListener = require("#modules/4.04-qualification/_shared/qualListener.model");
const {
  isListenerRequest,
  listenerScope,
} = require("./listenerContext");

const LISTENER_ID = "listener1";
const PASSPORT = "33333333333333";

const mockPassport = (oneIdPin) => {
  User.findById.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(oneIdPin ? { oneIdPin } : null),
    }),
  });
};

const mockListener = (id) => {
  QualListener.findOne.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(id ? { _id: id } : null),
    }),
  });
};

const reqAs = (roleTitle) => ({
  user: { _id: "user1", role: roleTitle ? { title: roleTitle } : null },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPassport(PASSPORT);
  mockListener(LISTENER_ID);
});

describe("isListenerRequest", () => {
  test("malaka_tinglovchi → true", () => {
    expect(isListenerRequest(reqAs("malaka_tinglovchi"))).toBe(true);
  });

  test("boshqa rol (menejer) → false", () => {
    expect(isListenerRequest(reqAs("malaka_menejer"))).toBe(false);
  });

  test("rolsiz / req yo'q → false (cheklov qo'llanmaydi, mavjud xatti-harakat)", () => {
    expect(isListenerRequest(reqAs(null))).toBe(false);
    expect(isListenerRequest({})).toBe(false);
    expect(isListenerRequest(undefined)).toBe(false);
  });
});

describe("listenerScope — tinglovchi BO'LMAGAN rollar cheklanmaydi", () => {
  test("menejer → {} (hammasini ko'radi)", async () => {
    expect(await listenerScope(reqAs("malaka_menejer"), "listener")).toEqual({});
  });

  test("menejer, passport maydoni bo'yicha ham → {}", async () => {
    expect(await listenerScope(reqAs("malaka_menejer"), "passport")).toEqual({});
  });

  test("cheklovsiz rolda DB'ga ortiqcha so'rov yubormaydi", async () => {
    await listenerScope(reqAs("malaka_menejer"), "listener");
    expect(User.findById).not.toHaveBeenCalled();
    expect(QualListener.findOne).not.toHaveBeenCalled();
  });
});

describe("listenerScope — tinglovchi FAQAT o'zinikini ko'radi", () => {
  test("listener ref maydoni → {listener: <o'z id>}", async () => {
    const scope = await listenerScope(reqAs("malaka_tinglovchi"), "listener");
    expect(scope).toEqual({ listener: LISTENER_ID });
  });

  test("passport maydoni (qualPetition) → {passport: <o'z PIN>}", async () => {
    const scope = await listenerScope(reqAs("malaka_tinglovchi"), "passport");
    expect(scope).toEqual({ passport: PASSPORT });
  });

  test("default maydon — 'listener'", async () => {
    expect(await listenerScope(reqAs("malaka_tinglovchi"))).toEqual({
      listener: LISTENER_ID,
    });
  });
});

describe("listenerScope — fail-closed (aniqlanmasa hech narsa ko'rsatmaydi)", () => {
  test("tinglovchi kartochkasi yo'q → hech narsaga mos kelmaydigan filtr", async () => {
    mockListener(null);
    const scope = await listenerScope(reqAs("malaka_tinglovchi"), "listener");
    expect(scope).toEqual({ _id: null });
    expect(scope).not.toEqual({});
  });

  test("passport (oneIdPin) topilmadi → hech narsaga mos kelmaydigan filtr", async () => {
    mockPassport(null);
    const scope = await listenerScope(reqAs("malaka_tinglovchi"), "passport");
    expect(scope).toEqual({ _id: null });
    expect(scope).not.toEqual({});
  });

  test("qaytgan filtr o'zgartirib bo'lmaydigan konstantani BUZMAYDI", async () => {
    mockListener(null);
    const a = await listenerScope(reqAs("malaka_tinglovchi"), "listener");
    const b = await listenerScope(reqAs("malaka_tinglovchi"), "listener");
    expect(b).toEqual({ _id: null });
    expect(a).toEqual({ _id: null });
  });
});
