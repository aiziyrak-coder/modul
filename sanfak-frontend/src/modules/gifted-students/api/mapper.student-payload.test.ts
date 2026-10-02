import { describe, it, expect } from 'vitest';
import { toStudentPayload } from './mapper';

describe('toStudentPayload — ism qismlari', () => {
  it('berilgan qismlar payloadga tushadi', () => {
    const p = toStudentPayload({
      name: 'Aliyev Sardor Botir o’g’li',
      lastName: 'Aliyev',
      firstName: 'Sardor',
      middleName: 'Botir o’g’li',
    });

    expect(p).toMatchObject({
      fullName: 'Aliyev Sardor Botir o’g’li',
      lastName: 'Aliyev',
      firstName: 'Sardor',
      middleName: 'Botir o’g’li',
    });
  });

  it('qismlar berilmasa KALIT umuman yuborilmaydi (`null` emas)', () => {
    const p = toStudentPayload({ name: 'Aliyev Sardor' });

    expect(p).not.toHaveProperty('lastName');
    expect(p).not.toHaveProperty('firstName');
    expect(p).not.toHaveProperty('middleName');
    expect(p.fullName).toBe('Aliyev Sardor');
  });

  it('bo’sh satr ham kalit qoldirmaydi', () => {
    const p = toStudentPayload({ name: 'X', lastName: '', firstName: '', middleName: '' });

    expect(p).not.toHaveProperty('lastName');
    expect(p).not.toHaveProperty('firstName');
    expect(p).not.toHaveProperty('middleName');
  });

  it('otasining ismisiz ham ikkitasi yuboriladi', () => {
    const p = toStudentPayload({ name: 'Aliyev Sardor', lastName: 'Aliyev', firstName: 'Sardor' });

    expect(p.lastName).toBe('Aliyev');
    expect(p.firstName).toBe('Sardor');
    expect(p).not.toHaveProperty('middleName');
  });

  it('akkaunt tanlanmasa `user: null` ketadi', () => {
    expect(toStudentPayload({ name: 'X' }).user).toBeNull();
  });

  it('akkaunt tanlansa o’sha id ketadi', () => {
    expect(toStudentPayload({ name: 'X', userId: 'u1' }).user).toBe('u1');
  });
});
