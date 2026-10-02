import { describe, expect, it } from 'vitest';
import { rejecterRoleLabel } from './rejecter-role';
import manifest from '../scientific-department.module';

const BACKEND_ROLES = [
  'ilmiy_bolim',
  'ilmiy_kengash_kotibi',
  'rektor',
  'prorektor',
  'dekan',
  'ssv',
];

const identity = (key: string) => key;

describe('rejecterRoleLabel', () => {
  it('backend yuboradigan har bir rol uchun label bor', () => {
    for (const role of BACKEND_ROLES) {
      expect(rejecterRoleLabel(role, identity), `qamrab olinmagan: ${role}`).not.toBeNull();
    }
  });

  it('noma`lum/bo`sh rol → null (xom `rektor` satri hech qachon chiqmaydi)', () => {
    expect(rejecterRoleLabel(null, identity)).toBeNull();
    expect(rejecterRoleLabel(undefined, identity)).toBeNull();
    expect(rejecterRoleLabel('', identity)).toBeNull();
    expect(rejecterRoleLabel('kafedra_mudiri', identity)).toBeNull();
  });

  it('qaytarilgan i18n kalitlari manifestda uchala tilda mavjud', () => {
    const i18n = manifest.i18n as Record<string, Record<string, string>> | undefined;
    expect(i18n, 'manifest i18n topilmadi').toBeDefined();

    for (const role of BACKEND_ROLES) {
      const key = rejecterRoleLabel(role, identity) as string;
      for (const lang of ['uz', 'ru', 'en']) {
        expect(i18n?.[lang]?.[key], `${lang} tilida yo'q: ${key} (rol: ${role})`).toBeDefined();
      }
    }
  });
});
