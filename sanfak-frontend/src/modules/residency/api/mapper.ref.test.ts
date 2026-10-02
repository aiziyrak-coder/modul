import { describe, expect, it } from 'vitest';
import { mapResident, mapAttendance, type BackendResident, type BackendAttendance } from './mapper';

const BASE: BackendResident = {
  _id: 'r1',
  program: 'ordinatura',
  fullName: 'Sobirova Nilufar',
};

describe('mapResident — havola nomlari (MD-40)', () => {
  it('populate BOR: ma’lumotnomaning HOZIRGI nomi g‘olib', () => {
    const r = mapResident({
      ...BASE,
      specialty: { _id: 's1', title: 'Nefrologiya', code: '70910101' },
      specialtyTitle: 'UI-Test Nefrologiya',
      specialtyCode: '00000000',
      department: { _id: 'd1', title: 'Ichki kasalliklar kafedrasi' },
      departmentTitle: 'Eski kafedra',
      group: { _id: 'g1', title: '2-guruh' },
      groupTitle: '1-guruh',
    });

    expect(r.specialtyTitle).toBe('Nefrologiya');
    expect(r.specialtyCode).toBe('70910101');
    expect(r.departmentTitle).toBe('Ichki kasalliklar kafedrasi');
    expect(r.groupTitle).toBe('2-guruh');
  });

  it('populate YO‘Q: snapshot ZAXIRASI ishlaydi (ustun bo‘shab qolmaydi)', () => {
    const r = mapResident({
      ...BASE,
      specialty: 's1',
      specialtyTitle: 'Nefrologiya',
      specialtyCode: '70910101',
      department: null,
      departmentTitle: 'Ichki kasalliklar kafedrasi',
      group: undefined,
      groupTitle: '2-guruh',
    });

    expect(r.specialtyTitle).toBe('Nefrologiya');
    expect(r.specialtyCode).toBe('70910101');
    expect(r.departmentTitle).toBe('Ichki kasalliklar kafedrasi');
    expect(r.groupTitle).toBe('2-guruh');
  });

  it('ustoz ismi: `select` da sharif yo‘q — snapshot SAQLANADI', () => {
    const r = mapResident({
      ...BASE,
      supervisor: { _id: 'u1', firstName: 'Jasur', lastName: 'Sobirov' },
      supervisorName: 'Sobirov Jasur Nodirovich',
    });

    expect(r.supervisorName).toBe('Sobirov Jasur Nodirovich');
  });

  it('ustoz ismi: HAQIQIY o‘zgarishda jonli akkaunt g‘olib', () => {
    const r = mapResident({
      ...BASE,
      supervisor: { _id: 'u1', firstName: 'Jasur', lastName: 'Nodirov' },
      supervisorName: 'Sobirov Jasur Nodirovich',
    });

    expect(r.supervisorName).toBe('Nodirov Jasur');
  });
});

const ATT_BASE = {
  _id: 'a1',
  resident: 'r1',
  date: '2026-09-01',
  status: 'present',
} as unknown as BackendAttendance;

describe('mapAttendance — fan nomi va o‘qituvchi', () => {
  it('fan: populate BOR -> hozirgi nom', () => {
    const a = mapAttendance({
      ...ATT_BASE,
      science: { _id: 'sc1', title: 'Kardiologiya' },
      scienceTitle: 'Eski fan nomi',
    } as unknown as BackendAttendance);

    expect(a.scienceTitle).toBe('Kardiologiya');
  });

  it('fan: populate YO‘Q -> snapshot zaxirasi', () => {
    const a = mapAttendance({
      ...ATT_BASE,
      science: 'sc1',
      scienceTitle: 'Kardiologiya',
    } as unknown as BackendAttendance);

    expect(a.scienceTitle).toBe('Kardiologiya');
  });

  it('o‘qituvchi: `select` da sharif yo‘q — snapshot saqlanadi', () => {
    const a = mapAttendance({
      ...ATT_BASE,
      teacher: { _id: 'u2', firstName: 'Sardor', lastName: 'Aliyev' },
      teacherName: 'Aliyev Sardor Botir o‘g‘li',
    } as unknown as BackendAttendance);

    expect(a.teacherName).toBe('Aliyev Sardor Botir o‘g‘li');
  });
});
