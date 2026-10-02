import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { describeOrderError, needsRefetch, REFRESH_REASONS, shouldRefresh } from './order-error';

const httpError = (status: number, data: unknown) =>
  new AxiosError('xato', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    data,
    headers: {} as AxiosHeaders,
    config: { headers: new AxiosHeaders() },
  });

const blobWithText = (body: string): Blob =>
  Object.assign(new Blob([body], { type: 'application/json' }), {
    text: () => Promise.resolve(body),
  });

describe('describeOrderError', () => {
  it('Blob JSON tana — reason va server matni', async () => {
    const body = JSON.stringify({
      status: 'error',
      statusCode: 409,
      message: 'Loyiha hali tayyor emas',
      detail: 'draft_not_ready',
      reason: 'draft_not_ready',
    });
    const info = await describeOrderError(httpError(409, blobWithText(body)));
    expect(info.status).toBe(409);
    expect(info.reason).toBe('draft_not_ready');
    expect(info.message).toBe('Loyiha hali tayyor emas');
    expect(info.meta).toEqual({});
  });

  it('obyekt tana, paper_date_invalid — matnda min VA max bor', async () => {
    const info = await describeOrderError(
      httpError(400, {
        status: 'error',
        statusCode: 400,
        message: "Buyruq sanasi noto'g'ri",
        reason: 'paper_date_invalid',
        min: '2026-09-20',
        max: '2026-09-27',
      }),
    );
    expect(info.reason).toBe('paper_date_invalid');
    expect(info.message).toContain('2026-09-20');
    expect(info.message).toContain('2026-09-27');
    expect(info.message.startsWith("Buyruq sanasi noto'g'ri")).toBe(true);
    expect(info.meta).toEqual({ min: '2026-09-20', max: '2026-09-27' });
  });

  it('JSON bo‘lmagan Blob — status bo‘yicha zaxira matn', async () => {
    const info = await describeOrderError(httpError(500, blobWithText('<html>oops</html>')));
    expect(info.reason).toBeNull();
    expect(info.message).toMatch(/Server xatosi/);
  });

  it('requireEri uslubidagi tana (faqat message/detail, reason yo‘q)', async () => {
    const info = await describeOrderError(
      httpError(400, { status: 'error', statusCode: 400, message: "ERI imzo noto'g'ri", detail: 'pkcs7' }),
    );
    expect(info.reason).toBeNull();
    expect(info.message).toBe("ERI imzo noto'g'ri");
  });

  it('faqat detail bo‘lsa — detail matni', async () => {
    const info = await describeOrderError(httpError(400, { detail: 'Tafsilot matni' }));
    expect(info.message).toBe('Tafsilot matni');
  });

  it('tarmoq xatosi (javob yo‘q) — «Server bilan aloqa yo‘q»', async () => {
    const info = await describeOrderError(new AxiosError('Network Error', 'ERR_NETWORK'));
    expect(info.status).toBeNull();
    expect(info.message).toBe("Server bilan aloqa yo'q");
  });

  it('403 matnsiz — ruxsat yo‘q; 404 order_not_found — o‘zbekcha matn', async () => {
    expect((await describeOrderError(httpError(403, {}))).message).toBe("Bu amal uchun ruxsatingiz yo'q");
    const nf = await describeOrderError(
      httpError(404, { message: 'not found', reason: 'order_not_found' }),
    );
    expect(nf.message).toBe("Buyruq topilmadi yoki rezident o'chirilgan");
  });

  it('boyitish: soat, o‘quv yili, rezident holati, joriy holat', async () => {
    const hours = await describeOrderError(
      httpError(409, { message: 'Soat 72 dan past', reason: 'hours_below_threshold', hours: 70 }),
    );
    expect(hours.message).toBe('Soat 72 dan past (joriy: 70 soat)');

    const year = await describeOrderError(
      httpError(409, {
        message: 'Yil yopilgan',
        reason: 'draft_year_closed',
        countingYear: '2025-2026',
        current: '2026-2027',
      }),
    );
    expect(year.message).toBe('Yil yopilgan (2025-2026; joriy 2026-2027)');

    const resident = await describeOrderError(
      httpError(409, { message: 'Mos emas', reason: 'resident_not_signable', residentStatus: 'akademik_tatil' }),
    );
    expect(resident.message).toBe("Mos emas (rezident holati: Akademik ta'til)");

    const notOpen = await describeOrderError(
      httpError(409, { message: 'Loyiha emas', reason: 'order_not_open', currentStatus: 'bekor_qilingan' }),
    );
    expect(notOpen.message).toBe('Loyiha emas (joriy holat: Bekor qilingan)');
  });

  it('Axios bo‘lmagan xato — o‘z matni', async () => {
    const info = await describeOrderError(new Error('boshqa'));
    expect(info).toEqual({ status: null, reason: null, message: 'boshqa', meta: {} });
  });
});

describe('shouldRefresh', () => {
  it('poyga sabablari — true', () => {
    for (const reason of ['order_not_open', 'scan_changed', 'hours_below_threshold', 'resident_inactive']) {
      expect(shouldRefresh(reason)).toBe(true);
    }
  });

  it('REFRESH_REASONS — AYNAN shu to‘plam (backend sabab nomlari bilan harfma-harf)', () => {
    expect([...REFRESH_REASONS].sort()).toEqual(
      [
        'draft_not_ready',
        'draft_pdf_missing',
        'draft_year_closed',
        'hours_below_threshold',
        'order_not_open',
        'resident_inactive',
        'resident_not_signable',
        'scan_already_uploaded',
        'scan_changed',
        'scan_limit',
      ].sort(),
    );
  });

  it('kiritma xatolari va null — false', () => {
    expect(shouldRefresh('paper_date_invalid')).toBe(false);
    expect(shouldRefresh('binding_mismatch')).toBe(false);
    expect(shouldRefresh(null)).toBe(false);
  });
});

describe('needsRefetch — amal xatosidan keyin buyruq qayta so‘ralsinmi', () => {
  it.each([
    [404, 'draft_pdf_missing', true],
    [404, 'resident_not_found', true],
    [404, 'order_not_found', true],
    [404, null, true],
    [409, 'order_not_open', true],
    [409, 'scan_changed', true],
    [400, 'paper_date_invalid', false],
    [403, 'not_office_signer', false],
    [500, null, false],
    [null, null, false],
  ])('status=%s, reason=%s → %s', (status, reason, expected) => {
    expect(needsRefetch({ status, reason })).toBe(expected);
  });
});
