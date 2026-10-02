import { describe, expect, it } from 'vitest';
import { toAttendancePayload } from './mapper';
import type { AttendanceWrite } from './types';

const SERVER_ONLY = ['samsVerified', 'manualVerified', 'checkInTime', 'checkOutTime'];

describe('toAttendancePayload — server-only maydonlar (P8/F2)', () => {
  it('eskirgan chaqiruvchi yuborgan server-only kalitlar tushib qoladi', () => {
    const stale = {
      residentId: 'r1',
      status: 'absent',
      date: '2026-09-27',
      samsVerified: true,
      manualVerified: true,
      checkInTime: '08:00',
      checkOutTime: '14:00',
    } as unknown as AttendanceWrite;

    const out = toAttendancePayload(stale);

    for (const key of SERVER_ONLY) expect(out).not.toHaveProperty(key);
    expect(out).toMatchObject({ resident: 'r1', status: 'absent', date: '2026-09-27' });
  });

  it('kechikish qoidasi o‘zgarmagan: `late:false` va `lateMinutes:null` ham yuboriladi', () => {
    const out = toAttendancePayload({ late: false, lateMinutes: null });

    expect(out).toEqual({ late: false, lateMinutes: null });
  });

  it('tip qulfi: `AttendanceWrite` server-only maydonni qabul qilmaydi', () => {
    const writes: AttendanceWrite[] = [
      // @ts-expect-error
      { samsVerified: true },
      // @ts-expect-error
      { manualVerified: true },
      // @ts-expect-error
      { checkInTime: '08:00' },
      // @ts-expect-error
      { checkOutTime: '14:00' },
    ];

    expect(writes).toHaveLength(4);
  });
});
