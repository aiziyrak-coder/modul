import { describe, it, expect } from 'vitest';
import {
  mapBase,
  mapStudent,
  mapContract,
  mapNotification,
  mapDistrict,
} from './mapper';

type BackendBase = Parameters<typeof mapBase>[0];
type BackendStudent = Parameters<typeof mapStudent>[0];
type BackendContract = Parameters<typeof mapContract>[0];
type BackendNotification = Parameters<typeof mapNotification>[0];
type BackendDistrict = Parameters<typeof mapDistrict>[0];

describe('mapBase', () => {
  it('maps _id -> id and orgType/region/district {_id,title} -> {id,title}', () => {
    const input: BackendBase = {
      _id: 'base-1',
      title: 'Markaziy shifoxona',
      orgType: { _id: 'ot-1', title: 'Davlat' },
      stir: '123456789',
      region: { _id: 'reg-1', title: 'Toshkent' },
      district: { _id: 'dis-1', title: 'Chilonzor' },
      address: 'Chilonzor 1',
      headName: 'Ali Valiyev',
      headJshshir: '12345678901234',
      headPhone: '+998901234567',
      email: 'info@clinic.uz',
      capacity: 50,
      active: true,
      createdAt: '2026-01-15T08:30:00.000Z',
    };

    const out = mapBase(input);

    expect(out.id).toBe('base-1');
    expect(out.title).toBe('Markaziy shifoxona');
    expect(out.orgType).toEqual({ id: 'ot-1', title: 'Davlat' });
    expect(out.region).toEqual({ id: 'reg-1', title: 'Toshkent' });
    expect(out.district).toEqual({ id: 'dis-1', title: 'Chilonzor' });
    expect(out.email).toBe('info@clinic.uz');
    expect(out.capacity).toBe(50);
    expect(out.active).toBe(true);
    expect(out.createdAt).toBe('2026-01-15');
    expect(out.responsibleUsers).toEqual([]);
  });

  it('preserves null email/capacity and falls back missing refs to {id:"",title:""}', () => {
    const input: BackendBase = {
      _id: 'base-2',
      title: 'Tuman shifoxonasi',
      orgType: null,
      stir: '987654321',
      region: null,
      district: null,
      address: 'Yunusobod 5',
      headName: 'Hasan Husanov',
      headJshshir: '43210987654321',
      headPhone: '+998935554433',
      email: null,
      capacity: null,
      active: false,
    };

    const out = mapBase(input);

    expect(out.email).toBeNull();
    expect(out.capacity).toBeNull();
    expect(out.orgType).toEqual({ id: '', title: '' });
    expect(out.region).toEqual({ id: '', title: '' });
    expect(out.district).toEqual({ id: '', title: '' });
    expect(out.createdAt).toBeUndefined();
  });

  it('D-043: maps responsibleUsers [] -> [] (bo\'sh)', () => {
    const input: BackendBase = {
      _id: 'base-3',
      title: 'Bo\'sh vakil bazasi',
      orgType: { _id: 'ot-1', title: 'Davlat' },
      stir: '111111111',
      region: { _id: 'reg-1', title: 'Toshkent' },
      district: { _id: 'dis-1', title: 'Chilonzor' },
      address: 'Chilonzor 2',
      headName: 'Olim Olimov',
      headJshshir: '11111111111111',
      headPhone: '+998901111111',
      active: true,
      responsibleUsers: [],
    };

    const out = mapBase(input);

    expect(out.responsibleUsers).toEqual([]);
  });

  it('D-043: maps responsibleUsers with 1 va bir nechta {_id,firstName,lastName,position} -> RepresentativeRef[]', () => {
    const input: BackendBase = {
      _id: 'base-4',
      title: 'Vakilli baza',
      orgType: { _id: 'ot-1', title: 'Davlat' },
      stir: '222222222',
      region: { _id: 'reg-1', title: 'Toshkent' },
      district: { _id: 'dis-1', title: 'Chilonzor' },
      address: 'Chilonzor 3',
      headName: 'Vali Valiyev',
      headJshshir: '22222222222222',
      headPhone: '+998902222222',
      active: true,
      responsibleUsers: [
        {
          _id: 'u-1',
          firstName: 'Aziz',
          lastName: 'Azizov',
          position: { _id: 'p-1', title: 'Bosh vrach' },
        },
        { _id: 'u-2', firstName: 'Karim', lastName: 'Karimov' },
      ],
    };

    const out = mapBase(input);

    expect(out.responsibleUsers).toEqual([
      { id: 'u-1', firstName: 'Aziz', lastName: 'Azizov', position: 'Bosh vrach' },
      { id: 'u-2', firstName: 'Karim', lastName: 'Karimov', position: null },
    ]);
  });

  it('D-043: responsibleUsers=null -> [] (backend `null` yuborishi mumkin)', () => {
    const input: BackendBase = {
      _id: 'base-5',
      title: 'Null vakil bazasi',
      orgType: { _id: 'ot-1', title: 'Davlat' },
      stir: '333333333',
      region: { _id: 'reg-1', title: 'Toshkent' },
      district: { _id: 'dis-1', title: 'Chilonzor' },
      address: 'Chilonzor 4',
      headName: 'Sardor Sardorov',
      headJshshir: '33333333333333',
      headPhone: '+998903333333',
      active: true,
      responsibleUsers: null,
    };

    const out = mapBase(input);

    expect(out.responsibleUsers).toEqual([]);
  });

  it('D-068: position {_id,title} obyekti -> title stringiga aylanadi', () => {
    const input: BackendBase = {
      _id: 'base-6',
      title: 'Populated position bazasi',
      orgType: { _id: 'ot-1', title: 'Davlat' },
      stir: '444444444',
      region: { _id: 'reg-1', title: 'Toshkent' },
      district: { _id: 'dis-1', title: 'Chilonzor' },
      address: 'Chilonzor 5',
      headName: 'Nodir Nodirov',
      headJshshir: '44444444444444',
      headPhone: '+998904444444',
      active: true,
      responsibleUsers: [
        {
          _id: 'u-3',
          firstName: 'Bek',
          lastName: 'Bekov',
          position: { _id: 'p-2', title: 'Direktor' },
        },
      ],
    };

    const out = mapBase(input);

    expect(out.responsibleUsers).toEqual([
      { id: 'u-3', firstName: 'Bek', lastName: 'Bekov', position: 'Direktor' },
    ]);
  });

  it('D-068: xom string ObjectId massivi -> [] (undefined id hosil bo\'lmaydi)', () => {
    const input: BackendBase = {
      _id: 'base-7',
      title: 'Xom string vakil bazasi',
      orgType: { _id: 'ot-1', title: 'Davlat' },
      stir: '555555555',
      region: { _id: 'reg-1', title: 'Toshkent' },
      district: { _id: 'dis-1', title: 'Chilonzor' },
      address: 'Chilonzor 6',
      headName: 'Ravshan Ravshanov',
      headJshshir: '55555555555555',
      headPhone: '+998905555555',
      active: true,
      responsibleUsers: ['6a73aaaaaaaaaaaaaaaaaaaa'],
    };

    const out = mapBase(input);

    expect(out.responsibleUsers).toEqual([]);
    expect(out.responsibleUsers.some((r) => r.id === undefined)).toBe(false);
  });

  it('D-068: massivdagi null element -> tashlab yuboriladi, faqat populated qoladi', () => {
    const input: BackendBase = {
      _id: 'base-8',
      title: 'Aralash vakillar bazasi',
      orgType: { _id: 'ot-1', title: 'Davlat' },
      stir: '666666666',
      region: { _id: 'reg-1', title: 'Toshkent' },
      district: { _id: 'dis-1', title: 'Chilonzor' },
      address: 'Chilonzor 7',
      headName: 'Jasur Jasurov',
      headJshshir: '66666666666666',
      headPhone: '+998906666666',
      active: true,
      responsibleUsers: [
        null,
        { _id: 'u-4', firstName: 'Dilnoza', lastName: 'Dilnozova', position: null },
      ],
    };

    const out = mapBase(input);

    expect(out.responsibleUsers).toEqual([
      { id: 'u-4', firstName: 'Dilnoza', lastName: 'Dilnozova', position: null },
    ]);
  });
});

describe('mapStudent', () => {
  it('maps _id -> id and academicYear/direction/region/district refs', () => {
    const input: BackendStudent = {
      _id: 'stu-1',
      fish: 'Olimov Olim',
      academicYear: { _id: 'ay-1', title: '2025/2026' },
      direction: { _id: 'dir-1', title: 'Davolash ishi' },
      course: 3,
      group: '301-A',
      region: { _id: 'reg-1', title: 'Toshkent' },
      district: { _id: 'dis-1', title: 'Chilonzor' },
      active: true,
    };

    const out = mapStudent(input);

    expect(out.id).toBe('stu-1');
    expect(out.fish).toBe('Olimov Olim');
    expect(out.academicYear).toEqual({ id: 'ay-1', title: '2025/2026' });
    expect(out.direction).toEqual({ id: 'dir-1', title: 'Davolash ishi' });
    expect(out.course).toBe(3);
    expect(out.group).toBe('301-A');
    expect(out.region).toEqual({ id: 'reg-1', title: 'Toshkent' });
    expect(out.district).toEqual({ id: 'dis-1', title: 'Chilonzor' });
    expect(out.active).toBe(true);
  });

  it('falls back null refs to {id:"",title:""}', () => {
    const input: BackendStudent = {
      _id: 'stu-2',
      fish: 'Karimov Karim',
      academicYear: null,
      direction: null,
      course: 1,
      group: '101-B',
      region: null,
      district: null,
      active: false,
    };

    const out = mapStudent(input);

    expect(out.academicYear).toEqual({ id: '', title: '' });
    expect(out.direction).toEqual({ id: '', title: '' });
    expect(out.region).toEqual({ id: '', title: '' });
    expect(out.district).toEqual({ id: '', title: '' });
  });
});

describe('mapDistrict', () => {
  it('maps _id -> id and region ref', () => {
    const input: BackendDistrict = {
      _id: 'dis-1',
      title: 'Chilonzor',
      province: { _id: 'reg-1', title: 'Toshkent' },
    };

    const out = mapDistrict(input);

    expect(out.id).toBe('dis-1');
    expect(out.title).toBe('Chilonzor');
    expect(out.region).toEqual({ id: 'reg-1', title: 'Toshkent' });
  });

  it('falls back missing region to {id:"",title:""}', () => {
    const input: BackendDistrict = { _id: 'dis-2', title: 'Sergeli' };

    const out = mapDistrict(input);

    expect(out.region).toEqual({ id: '', title: '' });
  });
});

describe('mapContract', () => {
  it('maps _id, students, computes/keeps studentsCount, rector signer, status, history', () => {
    const input: BackendContract = {
      _id: 'c-1',
      number: 'SH-001',
      organization: {
        _id: 'org-1',
        title: 'Shifo Plus',
        stir: '111222333',
        region: { _id: 'reg-1', title: 'Toshkent' },
        district: { _id: 'dis-1', title: 'Chilonzor' },
      },
      direction: { _id: 'dir-1', title: 'Davolash ishi' },
      academicYear: { _id: 'ay-1', title: '2025/2026' },
      course: 3,
      group: '301-A',
      students: [
        { _id: 's-1', fish: 'Olimov Olim', group: '301-A' },
        { _id: 's-2', fish: 'Karimov Karim', group: '301-B' },
      ],
      studentsCount: 2,
      startDate: '2026-02-01',
      endDate: '2026-05-01',
      note: 'Izoh',
      status: 'rektor_approved',
      rector: {
        signed: true,
        signer: { firstName: 'Said', lastName: 'Rektorov' },
        signedAt: '2026-02-10T10:00:00.000Z',
        certInfo: { serialNumber: 'SN-1', subject: 'CN=Said' },
      },
      history: [
        { at: '2026-02-01T00:00:00.000Z', actor: 'amaliyot', action: 'created' },
        { at: '2026-02-10T10:00:00.000Z', actor: 'rektor', action: 'approved', reason: 'ok' },
      ],
      createdAt: '2026-02-01T00:00:00.000Z',
    };

    const out = mapContract(input);

    expect(out.id).toBe('c-1');
    expect(out.number).toBe('SH-001');
    expect(out.organization).toEqual({
      id: 'org-1',
      title: 'Shifo Plus',
      stir: '111222333',
      region: { id: 'reg-1', title: 'Toshkent' },
      district: { id: 'dis-1', title: 'Chilonzor' },
    });
    expect(out.students).toEqual([
      { id: 's-1', fish: 'Olimov Olim', group: '301-A' },
      { id: 's-2', fish: 'Karimov Karim', group: '301-B' },
    ]);
    expect(out.studentsCount).toBe(2);
    expect(out.rector.signer).toBe('Said Rektorov');
    expect(out.rector.signed).toBe(true);
    expect(out.status).toBe('rektor_approved');
    expect(out.history).toEqual([
      { at: '2026-02-01T00:00:00.000Z', actor: 'amaliyot', action: 'created', reason: undefined },
      { at: '2026-02-10T10:00:00.000Z', actor: 'rektor', action: 'approved', reason: 'ok' },
    ]);
  });

  it('computes studentsCount from students length when not provided', () => {
    const input: BackendContract = {
      _id: 'c-2',
      number: 'SH-002',
      organization: { _id: 'org-2', title: 'Org 2' },
      students: [
        { _id: 's-1', fish: 'A' },
        { _id: 's-2', fish: 'B' },
        { _id: 's-3', fish: 'C' },
      ],
      startDate: '2026-03-01',
      endDate: '2026-06-01',
      status: 'draft',
    };

    const out = mapContract(input);

    expect(out.studentsCount).toBe(3);
    expect(out.students[0]).toEqual({ id: 's-1', fish: 'A', group: undefined });
    expect(out.history).toEqual([]);
  });

  it('F4 regression: organization=null -> ContractOrg id:"" + empty region/district, no throw', () => {
    const input: BackendContract = {
      _id: 'c-3',
      number: 'SH-003',
      organization: null,
      startDate: '2026-04-01',
      endDate: '2026-07-01',
      status: 'draft',
    };

    const out = mapContract(input);

    expect(out.organization.id).toBe('');
    expect(out.organization.title).toBe('');
    expect(out.organization.region).toEqual({ id: '', title: '' });
    expect(out.organization.district).toEqual({ id: '', title: '' });
    expect(out.students).toEqual([]);
    expect(out.studentsCount).toBe(0);
  });

  it('rector signer is null when ERI absent (defaults to signed:false)', () => {
    const input: BackendContract = {
      _id: 'c-4',
      number: 'SH-004',
      organization: { _id: 'org-4', title: 'Org 4' },
      startDate: '2026-04-01',
      endDate: '2026-07-01',
      status: 'in_progress',
    };

    const out = mapContract(input);

    expect(out.rector).toEqual({ signed: false });
  });
});

describe('mapNotification', () => {
  it('maps _id -> id, defaults nullable fields and stamps forRole', () => {
    const input: BackendNotification = {
      _id: 'n-1',
      title: 'Yangi shartnoma',
      createdAt: '2026-05-01T12:00:00.000Z',
    };

    const out = mapNotification(input, 'rektor');

    expect(out.id).toBe('n-1');
    expect(out.eventType).toBe('');
    expect(out.title).toBe('Yangi shartnoma');
    expect(out.body).toBeNull();
    expect(out.link).toBeNull();
    expect(out.read).toBe(false);
    expect(out.createdAt).toBe('2026-05-01T12:00:00.000Z');
    expect(out.forRole).toBe('rektor');
  });
});
