jest.mock("child_process", () => ({ spawn: jest.fn() }));

const { spawn } = require("child_process");

const fakeProc = (stdout = '{"ok":true}') => {
  const handlers = {};
  return {
    stdout: { on: (_e, cb) => cb(Buffer.from(stdout, "utf8")) },
    stderr: { on: () => {} },
    on: (event, cb) => {
      handlers[event] = cb;
      if (event === "close") setImmediate(() => cb(0));
    },
  };
};

describe("pythonParser — stdout encoding qulfi", () => {
  const parser = require("./pythonParser");

  beforeEach(() => {
    spawn.mockReset();
  });

  test("spawn PYTHONIOENCODING=utf-8 bilan chaqiriladi", async () => {
    spawn.mockReturnValue(fakeProc());

    await parser.parseReja("dummy.xlsx").catch(() => {});

    expect(spawn).toHaveBeenCalled();
    const [, , opts] = spawn.mock.calls[0];
    expect(opts).toBeDefined();
    expect(opts.env).toBeDefined();
    expect(opts.env.PYTHONIOENCODING).toBe("utf-8");
  });

  test("mavjud env o'zgaruvchilari YO'QOLMAYDI (PATH va h.k. saqlanadi)", async () => {
    spawn.mockReturnValue(fakeProc());
    await parser.parseReja("dummy.xlsx").catch(() => {});

    const [, , opts] = spawn.mock.calls[0];
    expect(opts.env.PATH ?? opts.env.Path).toBeDefined();
  });

  test("U+2018 belgisi utf8 sifatida buzilmasdan o'qiladi", async () => {
    const payload = JSON.stringify({ code: "O‘YT1104" });
    spawn.mockReturnValue(fakeProc(payload));

    const out = await parser.parseReja("dummy.xlsx").catch((e) => e.message);

    const text = typeof out === "string" ? out : JSON.stringify(out);
    expect(text).not.toContain("�");
  });
});
