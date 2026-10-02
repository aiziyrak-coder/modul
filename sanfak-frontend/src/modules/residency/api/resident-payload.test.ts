import { describe, it, expect } from 'vitest';
import { toAssignPayload, toResidentPayload } from './mapper';

describe('toResidentPayload — ism qismlari', () => {
  it('berilgan qismlar payloadga tushadi', () => {
    const p = toResidentPayload({
      program: 'ordinatura',
      fullName: 'Aliyev Sardor Botir o‘g‘li',
      lastName: 'Aliyev',
      firstName: 'Sardor',
      middleName: 'Botir o‘g‘li',
    });

    expect(p).toMatchObject({
      fullName: 'Aliyev Sardor Botir o‘g‘li',
      lastName: 'Aliyev',
      firstName: 'Sardor',
      middleName: 'Botir o‘g‘li',
    });
  });

  it('qismlar berilmasa KALIT umuman yuborilmaydi (`null` emas)', () => {
    const p = toResidentPayload({ program: 'ordinatura', fullName: 'Aliyev Sardor' });

    expect(p).not.toHaveProperty('lastName');
    expect(p).not.toHaveProperty('firstName');
    expect(p).not.toHaveProperty('middleName');
    expect(p.fullName).toBe('Aliyev Sardor');
  });

  it('bo‘sh satr ham kalit qoldirmaydi', () => {
    const p = toResidentPayload({
      program: 'ordinatura',
      fullName: 'X',
      lastName: '',
      firstName: '',
      middleName: '',
    });

    expect(p).not.toHaveProperty('lastName');
    expect(p).not.toHaveProperty('firstName');
    expect(p).not.toHaveProperty('middleName');
  });

  it('otasining ismisiz ham ikkitasi yuboriladi', () => {
    const p = toResidentPayload({
      program: 'magistratura',
      fullName: 'Aliyev Sardor',
      lastName: 'Aliyev',
      firstName: 'Sardor',
    });

    expect(p.lastName).toBe('Aliyev');
    expect(p.firstName).toBe('Sardor');
    expect(p).not.toHaveProperty('middleName');
  });

  it('dastur har doim uzatiladi', () => {
    expect(toResidentPayload({ program: 'magistratura' }).program).toBe('magistratura');
  });
});

describe('toAssignPayload — ustoz nomi (MD-24)', () => {
  it('`supervisorName` kaliti UMUMAN yuborilmaydi', () => {
    const out = toAssignPayload({ supervisorId: 'sup-1' });
    expect(out).not.toHaveProperty('supervisorName');
    expect(out.supervisor).toBe('sup-1');
  });

  it('qolgan biriktirish maydonlari o‘z joyida qoladi', () => {
    const out = toAssignPayload({
      supervisorId: 'sup-1',
      teachingLocation: '3-bino',
      practiceLocation: '1-son klinika',
      scheduleText: 'Du-Ju',
      weeklyHours: 0,
    });
    expect(out).toMatchObject({
      supervisor: 'sup-1',
      teachingLocation: '3-bino',
      practiceLocation: '1-son klinika',
      scheduleText: 'Du-Ju',
      weeklyHours: 0,
    });
  });
});
