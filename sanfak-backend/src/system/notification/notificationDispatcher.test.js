jest.mock("./notification.service", () => ({
  notify: jest.fn().mockResolvedValue({}),
}));
jest.mock("./notification.model");
jest.mock("./notificationPreference.model");
jest.mock("#modules/4.01-auth/user/user.model");
jest.mock("#system/_shared/socketHandler", () => ({
  emitToUser: jest.fn().mockResolvedValue(true),
}));

const { notify } = require("./notification.service");
const { dispatch, DEFAULT_PREFS } = require("./notificationDispatcher");
const Notification = require("./notification.model");
const { emitToUser } = require("#system/_shared/socketHandler");

const USER_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";

const sendEmail = (opts) =>
  dispatch({
    userId: USER_ID,
    eventType: "workload_rejected",
    overrideChannels: { email: true },
    user: { _id: USER_ID, email: "qabul@misol.uz" },
    title: "Sarlavha",
    ...opts,
  });

const lastHtml = () => {
  const calls = notify.mock.calls;
  return calls[calls.length - 1][0].message;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("notificationDispatcher — email HTML escaping (B6-item3)", () => {
  test("body'dagi <script> — HTML sifatida RENDER BO'LMAYDI, escape qilingan matn sifatida chiqadi", async () => {
    await sendEmail({
      title: "Xabar",
      body: "<script>alert(document.cookie)</script>",
    });

    const html = lastHtml();
    expect(html).not.toMatch(/<script>/i);
    expect(html).toContain(
      "&lt;script&gt;alert(document.cookie)&lt;/script&gt;",
    );
  });

  test("title'dagi teg ham escape qilinadi", async () => {
    await sendEmail({ title: "<img src=x onerror=alert(1)>" });

    const html = lastHtml();
    expect(html).not.toMatch(/<img/i);
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  test("quote-breaking nisbiy link — atributdan CHIQIB KETMAYDI (yangi atribut ochilmaydi)", async () => {
    await sendEmail({ link: '/study-load/1" onmouseover="alert(1)' });

    const html = lastHtml();
    expect(html).not.toMatch(/"\s*onmouseover=/);
    expect(html).toContain("&quot; onmouseover=&quot;alert(1)");
  });

  test("javascript: link — havola UMUMAN render qilinmaydi", async () => {
    await sendEmail({ link: "javascript:alert(document.cookie)" });

    const html = lastHtml();
    expect(html).not.toMatch(/<a /i);
    expect(html).not.toMatch(/javascript:/i);
  });

  test("protokol-nisbiy //host link — render qilinmaydi (tashqi yo'naltirish)", async () => {
    await sendEmail({ link: "//evil.example.com/phish" });

    const html = lastHtml();
    expect(html).not.toMatch(/<a /i);
  });

  test("backslash protokol-nisbiy /\\host link — render qilinmaydi", async () => {
    await sendEmail({ link: "/\\evil.example.com/phish" });

    const html = lastHtml();
    expect(html).not.toMatch(/<a /i);
  });

  test("to'g'ri nisbiy yo'l — havola render bo'ladi", async () => {
    await sendEmail({ link: "/study-load/distributions/123" });

    const html = lastHtml();
    expect(html).toContain('href="/study-load/distributions/123"');
  });

  test("to'g'ri http(s) mutlaq URL — havola render bo'ladi", async () => {
    await sendEmail({ link: "https://digut.uz/xabar/1" });

    const html = lastHtml();
    expect(html).toContain('href="https://digut.uz/xabar/1"');
  });

  test("link berilmagan — havola bloki umuman yo'q, xato yo'q", async () => {
    await sendEmail({});

    const html = lastHtml();
    expect(html).not.toContain("<a ");
  });

  test("oddiy matn (teg yo'q) — o'zgarishsiz o'tadi (regressiya qulfi)", async () => {
    await sendEmail({
      title: "Taqsimot rad etildi",
      body: "10 yillik amaliy tajriba talab qilinadi",
    });

    const html = lastHtml();
    expect(html).toContain("<h3>Taqsimot rad etildi</h3>");
    expect(html).toContain("<p>10 yillik amaliy tajriba talab qilinadi</p>");
  });
});

describe("notificationDispatcher — deliveryStatus.inApp haqiqiy natijani aks ettiradi (N-13)", () => {
  const dispatchInApp = (opts) =>
    dispatch({
      userId: USER_ID,
      eventType: "workload_rejected",
      overrideChannels: { inApp: true },
      title: "Sarlavha",
      ...opts,
    });

  const lastDeliveryStatus = () => {
    const calls = Notification.create.mock.calls;
    return calls[calls.length - 1][0].deliveryStatus;
  };

  test("emitToUser true qaytarsa (foydalanuvchi onlayn) — delivered:true yoziladi", async () => {
    emitToUser.mockResolvedValueOnce(true);
    await dispatchInApp({});
    expect(lastDeliveryStatus().inApp).toEqual({ delivered: true });
  });

  test("emitToUser false qaytarsa (foydalanuvchi oflayn) — delivered:false yoziladi (ilgari xato holda true yozilardi)", async () => {
    emitToUser.mockResolvedValueOnce(false);
    await dispatchInApp({});
    expect(lastDeliveryStatus().inApp).toEqual({ delivered: false });
  });

  test("emitToUser xato tashlasa — delivered:false + error xabari yoziladi (mavjud xato-yo'nalish saqlanadi)", async () => {
    emitToUser.mockRejectedValueOnce(new Error("socket xato"));
    await dispatchInApp({});
    expect(lastDeliveryStatus().inApp).toEqual({
      delivered: false,
      error: "socket xato",
    });
  });
});

describe("notificationDispatcher — DEFAULT_PREFS N-17 (yangi yozuvlar xulqni o'zgartirmaydi)", () => {
  const NEWLY_DOCUMENTED_EVENTS = [
    "residency_plan_reviewed",
    "residency_announcement_published",
    "task_submitted",
    "task_rejected_by_executor",
    "task_not_needed",
    "task_reopened",
    "task_deadline_changed",
    "council_task_overdue",
    "council_rank_accepted",
    "council_rank_returned",
    "council_voting_started",
    "council_voting_finished",
    "qualifying_applicant",
    "scientific_post",
    "contract_sent_to_rector",
    "contract_rektor_approved",
    "contract_both_approved",
    "contract_rejected",
  ];

  test.each(NEWLY_DOCUMENTED_EVENTS)(
    "%s — DEFAULT_PREFS qiymati _default bilan bir xil (xulq o'zgarmadi)",
    (eventType) => {
      expect(DEFAULT_PREFS[eventType]).toBeDefined();
      expect(DEFAULT_PREFS[eventType]).toEqual(DEFAULT_PREFS._default);
    },
  );
});

describe("notificationDispatcher — tashqi kanal timeout (F-17) va telegram chatId darvozasi (F-18)", () => {
  const ORIGINAL_TIMEOUT = process.env.NOTIFY_CHANNEL_TIMEOUT_MS;

  const lastDeliveryStatus = () => {
    const calls = Notification.create.mock.calls;
    return calls[calls.length - 1][0].deliveryStatus;
  };

  const dispatchExternal = (channels, user, opts = {}) =>
    dispatch({
      userId: USER_ID,
      eventType: "teacherLeave_rejected",
      overrideChannels: { inApp: true, ...channels },
      user: { _id: USER_ID, ...user },
      title: "Arizangiz rad etildi",
      body: "Sabab: sinov",
      ...opts,
    });

  afterEach(() => {
    if (ORIGINAL_TIMEOUT === undefined) {
      delete process.env.NOTIFY_CHANNEL_TIMEOUT_MS;
    } else {
      process.env.NOTIFY_CHANNEL_TIMEOUT_MS = ORIGINAL_TIMEOUT;
    }
    notify.mockReset();
    notify.mockResolvedValue({});
  });

  test("email kanali osilib qolsa — dispatch timeout ichida qaytadi, deliveryStatus.email = timeout, in-app + DB yozuvi baribir bo'ladi", async () => {
    process.env.NOTIFY_CHANNEL_TIMEOUT_MS = "50";
    notify.mockImplementationOnce(() => new Promise(() => {}));

    const started = Date.now();
    await dispatchExternal({ email: true }, { email: "qabul@misol.uz" });
    expect(Date.now() - started).toBeLessThan(2000);

    const ds = lastDeliveryStatus();
    expect(ds.email.delivered).toBe(false);
    expect(ds.email.error).toMatch(/email timeout \(50 ms\)/);
    expect(ds.inApp).toEqual({ delivered: true });
    expect(Notification.create).toHaveBeenCalledTimes(1);
  });

  test("NOTIFY_CHANNEL_TIMEOUT_MS berilmagan/yaroqsiz — default 3000 ms (0 yoki matn qabul qilinmaydi)", async () => {
    process.env.NOTIFY_CHANNEL_TIMEOUT_MS = "abc";
    await dispatchExternal({ email: true }, { email: "qabul@misol.uz" });
    expect(lastDeliveryStatus().email).toEqual({ delivered: true });
  });

  test("telegramChatId YO'Q — telegram kanaliga umuman chiqilmaydi (global chat'ga tushmaydi), sabab deliveryStatus'da", async () => {
    await dispatchExternal({ telegram: true }, {});

    expect(notify).not.toHaveBeenCalled();
    expect(lastDeliveryStatus().telegram).toEqual({
      delivered: false,
      error: "telegramChatId yo'q",
    });
  });

  test("telegramChatId BOR — telegram kanali foydalanuvchining O'Z chatId'si bilan chaqiriladi", async () => {
    await dispatchExternal({ telegram: true }, { telegramChatId: "123456" });

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "telegram", chatId: "123456" }),
    );
    expect(lastDeliveryStatus().telegram).toEqual({ delivered: true });
  });

  test("telegram xabari HTML-escape qilinadi (parse_mode: HTML) — <script>, <a href>, & matn bo'lib boradi", async () => {
    await dispatchExternal(
      { telegram: true },
      { telegramChatId: "123456" },
      {
        title: "Tasdiq bekor qilindi & qaytarildi",
        body: 'Sabab: <script>alert(1)</script> <a href="https://evil.example">bu yerga</a> a < b',
      },
    );

    const tgCall = notify.mock.calls.find(([opts]) => opts.type === "telegram");
    expect(tgCall).toBeDefined();
    const { message } = tgCall[0];
    expect(message).toBe(
      "Tasdiq bekor qilindi &amp; qaytarildi\n\n" +
        "Sabab: &lt;script&gt;alert(1)&lt;/script&gt; " +
        "&lt;a href=&quot;https://evil.example&quot;&gt;bu yerga&lt;/a&gt; a &lt; b",
    );
    expect(message).not.toMatch(/<script|<a /);
  });

  test("bir kanal xato bersa boshqasi yetib boradi — channels faqat yetganlarni sanaydi (inApp, email)", async () => {
    notify.mockImplementation(async (opts) => {
      if (opts.type === "telegram") throw new Error("tg xato");
      return {};
    });

    const result = await dispatchExternal(
      { telegram: true, email: true },
      { telegramChatId: "1", email: "qabul@misol.uz" },
    );

    expect(result.channels).toEqual(["inApp", "email"]);
    const ds = lastDeliveryStatus();
    expect(ds.telegram).toEqual({ delivered: false, error: "tg xato" });
    expect(ds.email).toEqual({ delivered: true });
  });
});
