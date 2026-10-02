import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '../../../study-load.module';
import { v142Step1Schema, v142Step3Schema } from '../../lib/v142-step-schemas';

const SRC = readFileSync(join(__dirname, 'science-program-v142-form-page.tsx'), 'utf8');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('study-load manifest — v142 route`lari (D-9, D-13)', () => {
  const routes = manifest.routes.map((r) => ({ path: r.path, permission: r.permission }));

  it("`science-programs/new-142` — `scienceProgram:create` (yangi RBAC kaliti YO'Q)", () => {
    expect(routes).toContainEqual({
      path: 'science-programs/new-142',
      permission: 'scienceProgram:create',
    });
  });

  it('`science-programs/:id/edit-142` — `scienceProgram:update`', () => {
    expect(routes).toContainEqual({
      path: 'science-programs/:id/edit-142',
      permission: 'scienceProgram:update',
    });
  });

  it("mavjud v259 route'lari O'ZGARMAGAN (new / :id/edit)", () => {
    expect(routes).toContainEqual({ path: 'science-programs/new', permission: 'scienceProgram:create' });
    expect(routes).toContainEqual({
      path: 'science-programs/:id/edit',
      permission: 'scienceProgram:update',
    });
  });
});

describe('v142 bosqich sxemalari — qattiq blok FAQAT mavzu qatori (§6.6 C)', () => {
  const okTopics = { topics: [{ type: 'maruza', code: '', title: 'A', hours: 1, refs: '' }], independentTasks: [] };

  it('mavzu soati 0 → xato (`topicHoursMin`); 1 → o`tadi', async () => {
    await expect(
      v142Step3Schema.validate({
        ...okTopics,
        topics: [{ type: 'maruza', code: '', title: 'A', hours: 0, refs: '' }],
      }),
    ).rejects.toThrow('scienceProgram.v142.validation.topicHoursMin');
    await expect(v142Step3Schema.validate(okTopics)).resolves.toBeTruthy();
  });

  it("tur tanlanmagan (`''`) → `topicTypeRequired`; nom bo'sh → `topicTitleRequired`", async () => {
    await expect(
      v142Step3Schema.validate({
        ...okTopics,
        topics: [{ type: '', code: '', title: 'A', hours: 2, refs: '' }],
      }),
    ).rejects.toThrow('scienceProgram.v142.validation.topicTypeRequired');
    await expect(
      v142Step3Schema.validate({
        ...okTopics,
        topics: [{ type: 'amaliy', code: '', title: '   ', hours: 2, refs: '' }],
      }),
    ).rejects.toThrow('scienceProgram.v142.validation.topicTitleRequired');
  });

  it("soat ↔ §1 mosligi sxemada TEKSHIRILMAYDI — 999 soat ham o'tadi (ogohlantirish confirm'da)", async () => {
    await expect(
      v142Step3Schema.validate({
        ...okTopics,
        topics: [{ type: 'maruza', code: '', title: 'A', hours: 999, refs: '' }],
      }),
    ).resolves.toBeTruthy();
    await expect(
      v142Step3Schema.validate({
        ...okTopics,
        topics: [{ type: 'maruza', code: '', title: 'A', hours: 1000, refs: '' }],
      }),
    ).rejects.toThrow('scienceProgram.v142.validation.hoursMax');
  });

  it("1-bosqich: `science` shart; protokol raqami PROTOCOL_RX (`6`, `3/2026` ✓, `abc` ✗)", async () => {
    const base = {
      science: 'sci-1',
      councilProtocol: { date: null, number: '3/2026' },
      departmentProtocol: { date: null, number: '6' },
      authors: [{ fio: '', degree: '', title: '', department: '', position: '' }],
      reviewers: [],
    };
    await expect(v142Step1Schema.validate(base)).resolves.toBeTruthy();
    await expect(v142Step1Schema.validate({ ...base, science: '' })).rejects.toThrow(
      'scienceProgram.validation.scienceRequired',
    );
    await expect(
      v142Step1Schema.validate({ ...base, councilProtocol: { date: null, number: 'abc' } }),
    ).rejects.toThrow('scienceProgram.v142.validation.protocolNumber');
    await expect(
      v142Step1Schema.validate({
        ...base,
        authors: [{ fio: '', degree: 'PhD', title: '', department: '', position: '' }],
      }),
    ).rejects.toThrow('scienceProgram.v142.validation.fioRequired');
  });
});

describe('science-program-v142-form-page — manba qulflari', () => {
  it('asosiy tugma `htmlType="button"` + `onClick` — `htmlType="submit"` UMUMAN YO`Q (ikki marta submit tuzog`i)', () => {
    const code = stripComments(SRC);
    expect(code).toMatch(/htmlType="button"/);
    expect(code).not.toMatch(/htmlType="submit"/);
  });

  it("soat mos kelmasa `modal.confirm` chaqiriladi va OK → `submitForm` (blok EMAS, D-10)", () => {
    const code = stripComments(SRC);
    expect(code).toMatch(/hasHoursMismatch\(rows\)/);
    expect(code).toMatch(/modal\.confirm\(\{[\s\S]*?confirmMismatchTitle[\s\S]*?onOk: \(\) => formik\.submitForm\(\)/);
  });

  it("`toV142Payload(..., true)` FAQAT `createMutation`, `false` FAQAT `updateMutation` (formVersion qulfi)", () => {
    const creates = SRC.match(
      /createMutation\.mutateAsync\(\s*toV142Payload\(values, findScience\(values\.science\), true, LITERATURE_GROUP_TITLES\),?\s*\)/g,
    );
    const updates = SRC.match(
      /updateMutation\.mutateAsync\(\s*toV142Payload\(values, findScience\(values\.science\), false, LITERATURE_GROUP_TITLES\),?\s*\)/g,
    );
    expect(creates?.length).toBe(2);
    expect(updates?.length).toBe(2);
    expect(SRC.match(/updateMutation\.mutateAsync\([^;]*\btrue\b[^;]*\)/g)).toBeNull();
  });

  it("v259 hujjat `edit-142` bilan ochilsa eski wizardga yo'naltiriladi — tekshiruv MUSBAT (`=== 'v142'`)", () => {
    const code = stripComments(SRC);
    expect(code).toMatch(/formVersion === 'v142'/);
    expect(code).not.toMatch(/!== 'v259'/);
    expect(code).toMatch(/<Navigate to=\{`\$\{LIST_PATH\}\/\$\{id\}\/edit`\} replace \/>/);
  });

  it("faqat `draft` tahrirlanadi — `locked` → `<Form disabled>` + saqlash tugmalari yo'q", () => {
    const code = stripComments(SRC);
    expect(code).toMatch(/detail\.status !== 'draft'/);
    expect(code).toMatch(/disabled=\{locked\}/);
  });
});
