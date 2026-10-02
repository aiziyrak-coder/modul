import { describe, expect, it } from 'vitest';
import { mapNotification } from './mapper';
import type { BackendNotification } from '../model/types';

function backend(
  fields: Pick<BackendNotification, 'eventType' | 'title' | 'body'> &
    Partial<BackendNotification>,
): BackendNotification {
  return {
    _id: '65f0000000000000000000aa',
    metadata: null,
    link: null,
    read: false,
    readAt: null,
    createdAt: '2026-08-10T09:15:00.000Z',
    ...fields,
  };
}

const FIXTURES: BackendNotification[] = [
  backend({
    eventType: 'eri_expiring',
    title: 'ERI sertifikati 7 kundan keyin tugaydi',
    body: "Sertifikat seriya: AB1234567\nTugash sanasi: 2026-08-21\nYangilash uchun ERI markazi bilan bog'laning.",
    metadata: { serialNumber: 'AB1234567', daysLeft: 7 },
    link: '/profile/eri',
  }),
  backend({
    eventType: 'eri_expired',
    title: '❗ ERI sertifikati tugadi',
    body: "Sertifikat seriya: AB1234567\nEndi siz tasdiqlash amallarini bajarib bo'lmaysiz.\nYangi sertifikat olish uchun ERI markazi bilan bog'laning.",
    metadata: null,
    link: '/profile/eri',
  }),
  backend({
    eventType: 'sla_overdue',
    title: "⚠️ SLA bo'yicha kechikish",
    body: 'Hujjat: Ishchi reja (O\'quv jarayoni)\nBosqich: Kafedra mudiri\nMas\'ul: Aliyev Vali\nMuddati o\'tdi: 3 kun',
    metadata: { chainId: '65f0000000000000000000bb', daysOverdue: 3 },
    link: null,
  }),
  backend({
    eventType: 'sla_escalated',
    title: '🚨 SLA ESKALATSIYA',
    body: 'Tasdiqlash bosqichi kechikmoqda — sizga eskalatsiya qilindi\nHujjat: Ishchi reja\nBosqich: Dekan\nKechikish: 5 kun',
    metadata: { chainId: '65f0000000000000000000cc', originalRole: 'kafedra_mudiri' },
    link: null,
  }),
  backend({
    eventType: 'vacancy_reassigned',
    title: 'Sizga yangi yuklama biriktirildi',
    body: 'Vakant fan(lar) sizga biriktirildi.\nSoat: 120\nTasdiqlash uchun shaxsiy kabinetga kiring.',
    metadata: { distributionId: '65f0000000000000000000dd', entryId: '65f0000000000000000000ee', previousTeacher: '65f0000000000000000000ff' },
    link: '/distributions/65f0000000000000000000dd',
  }),
  backend({
    eventType: 'recalc_required',
    title: '🔄 Yuklama qayta hisoblash kerak',
    body: 'Guruh kontingenti o\'zgardi: 24 → 27 talaba\nTa\'sirlangan yuklamalar: 12\nTa\'sirlangan taqsimotlar: 3\nIltimos, ko\'rib chiqing va tasdiqlang.',
    metadata: {
      groupId: '65f0000000000000000000a1',
      oldCount: 24,
      newCount: 27,
      affectedWorkloads: ['65f0000000000000000000a2', '65f0000000000000000000a3'],
    },
    link: '/distributions?needsRecalculation=true',
  }),
  backend({
    eventType: 'residency_plan_reviewed',
    title: 'Faoliyat rejasi: bajaruv tasdiqlandi',
    body: 'Bemorlar bilan mustaqil ish (fevral)',
    metadata: null,
    link: '/residency/faoliyat-rejasi/65f0000000000000000000a4',
  }),
  backend({
    eventType: 'residency_plan_reviewed',
    title: 'Dissertatsiya rejasi: bajaruv qaytarildi',
    body: null,
    metadata: null,
    link: '/residency/dissertatsiya/65f0000000000000000000a5',
  }),
  backend({
    eventType: 'task_assigned',
    title: 'Yangi topshiriq',
    body: 'Kafedra hisobotini tayyorlash',
    metadata: { taskId: '65f0000000000000000000a6', code: 'T-0042' },
    link: '/tasks/65f0000000000000000000a6',
  }),
  backend({
    eventType: 'task_assigned',
    title: 'T: "Kafedra hisobotini tayyorlash" topshiriq sizga biriktirildi',
    body: null,
    metadata: { taskId: '65f0000000000000000000a7', code: 'T' },
    link: '/kengash/topshiriqlar',
  }),
  backend({
    eventType: 'announcement_new',
    title: 'E: Yangi o\'quv yili boshlanishi haqida',
    body: "Barcha kafedra mudirlari va o'qituvchilarga ma'lum qilinadiki, 2026-2027 o'quv yili 1-sentabr kuni boshlanadi. Barcha tayyorgarlik ishlarini",
    metadata: { announcementId: '65f0000000000000000000a8', code: 'E' },
    link: '/kengash/elonlar',
  }),
  backend({
    eventType: 'council_rank_returned',
    title: 'U: Unvon arizangiz qaytarildi',
    body: "Ariza forma talablariga to'liq javob bermaydi — ilmiy ishlar ro'yxati yetarli emas.",
    metadata: { applicationId: '65f0000000000000000000a9', code: 'U' },
    link: '/kengash/unvonlar',
  }),
  backend({
    eventType: 'council_voting_finished',
    title: 'V: "Yangi kafedra ochish" ovoz berish yakunlandi',
    body: 'Natija: tasdiqlandi',
    metadata: null,
    link: '/kengash/hisobotlar',
  }),
  backend({
    eventType: 'qualifying_applicant',
    title: 'Ariza rad etildi',
    body: 'Sabab: Hujjatlar to\'liq emas, qayta topshiring.',
    metadata: { applicantId: '65f0000000000000000000b1' },
    link: '/scientific-department/qualification-exam',
  }),
  backend({
    eventType: 'scientific_post',
    title: 'Yangi ilmiy nashr talablari',
    body: "Hurmatli hamkasblar, 2026-yil uchun ilmiy nashr talablari yangilandi.\nBatafsil ma'lumot uchun bo'lim bilan bog'laning.",
    metadata: { postId: '65f0000000000000000000b2', specialtyCode: '' },
    link: '/scientific-department/announcements',
  }),
  backend({
    eventType: 'contract_rejected',
    title: 'Shartnoma rad etildi',
    body: '№ 145 — sabab: imzo mos kelmadi',
    metadata: { contractId: '65f0000000000000000000b3' },
    link: '/shartnomalar/65f0000000000000000000b3',
  }),
];

describe('mapNotification — zero-loss seam (spec §1)', () => {
  it.each(FIXTURES)(
    '$eventType — body/metadata/eventType bayt-ma-bayt saqlanadi',
    (raw) => {
      const vm = mapNotification(raw);

      expect(vm.body).toBe(raw.body);
      expect(vm.metadata).toEqual(raw.metadata);
      expect(vm.eventType).toBe(raw.eventType);
      expect(vm.id).toBe(raw._id);

      if (raw.body !== null) {
        expect(vm.bodyLines).toHaveLength(raw.body.split('\n').length);
        expect(vm.title).not.toContain(raw.body);
      } else {
        expect(vm.bodyLines).toEqual(['']);
      }
    },
  );
});

describe('mapNotification — title/body hech qachon birlashtirilmaydi', () => {
  it('vm.title BACKEND title bilan aynan teng (kesish/birlashtirish yo\'q)', () => {
    const raw = backend({
      eventType: 'task_assigned',
      title: 'Yangi topshiriq',
      body: 'Kafedra hisobotini tayyorlash',
    });
    const vm = mapNotification(raw);
    expect(vm.title).toBe('Yangi topshiriq');
    expect(vm.title).not.toContain(':');
  });
});

describe('mapNotification — sana Date obyekt (string EMAS)', () => {
  it('createdAt va readAt Date instansiyasiga aylanadi', () => {
    const raw = backend({
      eventType: 'task_submitted',
      title: 'Topshiriq tekshiruvga yuborildi',
      body: 'T-0099: Fan dasturi',
      createdAt: '2026-08-10T09:15:00.000Z',
      readAt: '2026-08-11T10:00:00.000Z',
      read: true,
    });
    const vm = mapNotification(raw);
    expect(vm.createdAt).toBeInstanceOf(Date);
    expect(vm.createdAt.toISOString()).toBe('2026-08-10T09:15:00.000Z');
    expect(vm.readAt).toBeInstanceOf(Date);
    expect(vm.readAt?.toISOString()).toBe('2026-08-11T10:00:00.000Z');
  });

  it('readAt null bo\'lsa null qoladi (Invalid Date emas)', () => {
    const raw = backend({ eventType: 'task_submitted', title: 'x', body: 'y', readAt: null });
    expect(mapNotification(raw).readAt).toBeNull();
  });
});

describe('mapNotification — metadata massiv qiymatini yo\'qotmaydi', () => {
  it('affectedWorkloads massivi to\'liq saqlanadi (Object.entries tuzog\'i yo\'q)', () => {
    const raw = backend({
      eventType: 'recalc_required',
      title: '🔄 Yuklama qayta hisoblash kerak',
      body: 'Guruh kontingenti o\'zgardi: 24 → 27 talaba',
      metadata: { affectedWorkloads: ['a1', 'a2', 'a3'] },
    });
    const vm = mapNotification(raw);
    expect(vm.metadata?.affectedWorkloads).toEqual(['a1', 'a2', 'a3']);
  });
});

describe('mapNotification — rawLink xom saqlanadi, safeLink guard orqali hosil bo\'ladi', () => {
  it('xavfli rawLink saqlanadi, lekin safeLink null bo\'ladi', () => {
    const raw = backend({
      eventType: 'council_rank_returned',
      title: 'x',
      body: 'y',
      link: 'javascript:alert(1)',
    });
    const vm = mapNotification(raw);
    expect(vm.rawLink).toBe('javascript:alert(1)');
    expect(vm.safeLink).toBeNull();
  });

  it('mos keladigan basePath\'li link ikkalasida ham to\'g\'ri', () => {
    const raw = backend({
      eventType: 'announcement_new',
      title: 'E: x',
      body: 'y',
      link: '/kengash/elonlar',
    });
    const vm = mapNotification(raw);
    expect(vm.rawLink).toBe('/kengash/elonlar');
    expect(vm.safeLink).toBe('/kengash/elonlar');
  });
});
