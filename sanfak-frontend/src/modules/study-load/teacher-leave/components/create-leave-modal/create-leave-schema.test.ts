import { describe, expect, it, vi } from 'vitest';
import { createLeaveSchema, preventEnterSubmit } from './schema';

const FROM = '2026-10-01T00:00:00.000Z';
const TO = '2026-10-14T00:00:00.000Z';

const validate = async (values: Record<string, string>) => {
  try {
    await createLeaveSchema.validate(values, { abortEarly: false });
    return [] as string[];
  } catch (e) {
    return (e as { errors: string[] }).errors;
  }
};

describe('createLeaveSchema — P-32 majburiy maydonlar', () => {
  it('faqat type (Enter bilan yuborilgan bo‘sh forma) → sabab + boshlanish sanasi xatolari', async () => {
    const errors = await validate({ type: 'leave', teacher: '', reason: '', distribution: '', fromDate: '', toDate: '' });
    expect(errors).toEqual(
      expect.arrayContaining([
        'studyLoad.teacherLeave.form.reasonRequired',
        'studyLoad.teacherLeave.form.fromDateRequired',
        'studyLoad.teacherLeave.form.toDateRequired',
      ]),
    );
  });

  it('leave: to‘liq → xatosiz', async () => {
    expect(await validate({ type: 'leave', teacher: '', reason: 'Mehnat ta‘tili', distribution: '', fromDate: FROM, toDate: TO })).toEqual([]);
  });

  it('leave: toDate < fromDate → xato', async () => {
    const errors = await validate({ type: 'leave', teacher: '', reason: 'Mehnat ta‘tili', distribution: '', fromDate: TO, toDate: FROM });
    expect(errors).toContain('studyLoad.teacherLeave.form.toDateBeforeFrom');
  });

  it('resignation / transfer: toDate ixtiyoriy', async () => {
    expect(await validate({ type: 'resignation', teacher: '', reason: 'Boshqa ishga', distribution: '', fromDate: FROM, toDate: '' })).toEqual([]);
    expect(await validate({ type: 'transfer', teacher: '', reason: 'Kafedra almashish', distribution: '', fromDate: FROM, toDate: '' })).toEqual([]);
  });

  it('sabab 3 belgidan qisqa → xato', async () => {
    const errors = await validate({ type: 'leave', teacher: '', reason: 'ab', distribution: '', fromDate: FROM, toDate: TO });
    expect(errors).toContain('studyLoad.teacherLeave.form.reasonMin');
  });
});

describe('preventEnterSubmit — Enter faqat tugma orqali', () => {
  const evt = (tagName: string, key = 'Enter') =>
    ({ key, target: { tagName }, preventDefault: vi.fn() }) as unknown as React.KeyboardEvent<HTMLFormElement>;

  it('INPUT (DatePicker/Select) ichida Enter → preventDefault', () => {
    const e = evt('INPUT');
    preventEnterSubmit(e);
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('TEXTAREA (sabab) va BUTTON ichida Enter → o‘tkaziladi', () => {
    const ta = evt('TEXTAREA');
    const btn = evt('BUTTON');
    preventEnterSubmit(ta);
    preventEnterSubmit(btn);
    expect(ta.preventDefault).not.toHaveBeenCalled();
    expect(btn.preventDefault).not.toHaveBeenCalled();
  });

  it('boshqa tugma → tegilmaydi', () => {
    const e = evt('INPUT', 'Tab');
    preventEnterSubmit(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
