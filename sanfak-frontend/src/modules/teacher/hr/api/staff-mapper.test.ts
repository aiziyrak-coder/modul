import { describe, expect, it } from 'vitest';
import { mapStaffDetail, mapStaffListItem, toStaffFormValues, type BackendStaffUser } from './staff-mapper';
import { emptyStaffFormValues } from '../model/staff-types';

const backendUser: BackendStaffUser = {
  _id: 'u1',
  firstName: 'Ali',
  lastName: 'Valiyev',
  middleName: 'Vali o\'g\'li',
  email: 'ali@example.com',
  phone: '998901234567',
  photo: '/uploads/photo/staff/1.jpg',
  department: { _id: 'd1', title: 'Ichki kasalliklar', faculty: { _id: 'f1', title: 'Davolash' } },
  position: { _id: 'p1', title: 'Dotsent' },
  jshshir: '12345678901234',
  passportSeria: 'AA',
  passportNumber: 1234567,
  googleScholar: 'https://scholar.google.com/x',
  scopus: 'https://scopus.com/x',
  active: true,
  createdAt: '2026-02-11T10:00:00.000Z',
  degrees: {
    bachelorDegree: [{ title: 'diplom.pdf', path: '/uploads/bachelor/1.pdf' }],
    masterDegree: [],
    scientificDegree: [],
    scientificTitle: [],
  },
};

describe('staff mapper — list item', () => {
  it('maps _id → id, derives full name and faculty via department.faculty', () => {
    const item = mapStaffListItem(backendUser);
    expect(item.id).toBe('u1');
    expect(item.fullName).toBe("Valiyev Ali Vali o'g'li");
    expect(item.positionTitle).toBe('Dotsent');
    expect(item.departmentTitle).toBe('Ichki kasalliklar');
    expect(item.facultyTitle).toBe('Davolash');
    expect(item.phone).toBe('998901234567');
  });

  it('falls back to nulls when refs are unpopulated strings', () => {
    const item = mapStaffListItem({ ...backendUser, department: 'd1', position: 'p1' });
    expect(item.departmentTitle).toBeNull();
    expect(item.positionTitle).toBeNull();
    expect(item.facultyTitle).toBeNull();
  });
});

describe('staff mapper — detail + form values', () => {
  it('maps passportSeria (backend name) → passportSeries, passportNumber → string', () => {
    const detail = mapStaffDetail(backendUser);
    expect(detail.passportSeries).toBe('AA');
    expect(detail.passportNumber).toBe('1234567');
    expect(detail.department).toBe('d1');
    expect(detail.faculty).toBe('f1');
    expect(detail.bachelorDegree).toHaveLength(1);
  });

  it('toStaffFormValues seeds new-file arrays empty and keeps existing docs', () => {
    const detail = mapStaffDetail(backendUser);
    const values = toStaffFormValues(detail);
    expect(values.firstName).toBe('Ali');
    expect(values.bachelorDegree).toHaveLength(1);
    expect(values.bachelorDegreeNew).toEqual([]);
    expect(values.existingPhotoUrl).toBe(backendUser.photo);
  });

  it('toStaffFormValues(null) returns the empty defaults', () => {
    expect(toStaffFormValues(null)).toEqual(emptyStaffFormValues);
  });
});

describe('staff mapper — teachingSpecialty* (Faza 1b)', () => {
  it('4 maydonni backenddan detailga o\'tkazadi', () => {
    const detail = mapStaffDetail({
      ...backendUser,
      teachingSpecialtyName: 'Bolalar stomatologiyasi',
      teachingSpecialtyCode: '14.00.07',
      teachingSpecialtyBasis: 'diplom',
      teachingSpecialtyNote: 'Muqobil asos',
    });
    expect(detail.teachingSpecialtyName).toBe('Bolalar stomatologiyasi');
    expect(detail.teachingSpecialtyCode).toBe('14.00.07');
    expect(detail.teachingSpecialtyBasis).toBe('diplom');
    expect(detail.teachingSpecialtyNote).toBe('Muqobil asos');
  });

  it('maydonlar yo\'q (eski profil) bo\'lsa hammasi null', () => {
    const detail = mapStaffDetail(backendUser);
    expect(detail.teachingSpecialtyName).toBeNull();
    expect(detail.teachingSpecialtyCode).toBeNull();
    expect(detail.teachingSpecialtyBasis).toBeNull();
    expect(detail.teachingSpecialtyNote).toBeNull();
  });

  it('noma\'lum/eskirgan basis qiymati (enum drift) — null qaytaradi, forma qulamaydi', () => {
    const detail = mapStaffDetail({ ...backendUser, teachingSpecialtyBasis: 'eskirgan_qiymat' });
    expect(detail.teachingSpecialtyBasis).toBeNull();
  });

  it('toStaffFormValues — mavjud qiymatlarni saqlaydi, yo\'qlarini bo\'sh satrga aylantiradi', () => {
    const detail = mapStaffDetail({
      ...backendUser,
      teachingSpecialtyName: 'Kardiologiya',
      teachingSpecialtyCode: '14.00.03',
      teachingSpecialtyBasis: 'sertifikat',
      teachingSpecialtyNote: null,
    });
    const values = toStaffFormValues(detail);
    expect(values.teachingSpecialtyName).toBe('Kardiologiya');
    expect(values.teachingSpecialtyCode).toBe('14.00.03');
    expect(values.teachingSpecialtyBasis).toBe('sertifikat');
    expect(values.teachingSpecialtyNote).toBe('');
  });

  it('toStaffFormValues(null) — barcha 4 maydon bo\'sh default', () => {
    const values = toStaffFormValues(null);
    expect(values.teachingSpecialtyName).toBe('');
    expect(values.teachingSpecialtyCode).toBe('');
    expect(values.teachingSpecialtyBasis).toBeNull();
    expect(values.teachingSpecialtyNote).toBe('');
  });
});
