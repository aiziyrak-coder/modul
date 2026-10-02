import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@/app/session';
import { ROLE_STEP, useMyApprovalStepKeys } from './use-my-pending-step';

function login(roleNames: string[], permissions: string[] = ['personalWorkPlan:approve']) {
  act(() => {
    useSessionStore.setState({
      status: 'authenticated',
      user: {
        id: 'u1',
        email: 'u1@test.local',
        fullName: 'Test User',
        roles: roleNames.map((name, i) => ({ id: `r${i}`, name })),
      },
      permissions,
    });
  });
}

function logout() {
  act(() => {
    useSessionStore.setState({ status: 'unauthenticated', user: null, permissions: [] });
  });
}

const render = () => renderHook(() => useMyApprovalStepKeys()).result.current;

afterEach(() => {
  logout();
});

describe('ROLE_STEP — backend personalWorkPlan.service.js:29-38 nusxasi', () => {
  it('aynan 8 ta kalit (zanjir to`liq, ortiqchasi yo`q)', () => {
    expect(Object.keys(ROLE_STEP)).toHaveLength(8);
  });

  it('rol → bosqich xaritasi backend bilan AYNAN bir xil', () => {
    expect(ROLE_STEP).toEqual({
      oqituvchi: 'teacher',
      kafedra_uslubiy_masul: 'kafedraUslubiy',
      kafedra_ilmiy_masul: 'kafedraIlmiy',
      kafedra_ustoz_shogird_masul: 'kafedraUstozShogird',
      kafedra_mudiri: 'kafedraMudiri',
      oquv_uslubiy_boshqarma: 'oquvUslubiy',
      dekan: 'dekan',
      ichki_nazorat: 'ichkiNazorat',
    });
  });

  it('`ilmiy_bolim` va `fakultet_kengash_kotibi` xaritada YO`Q (qasddan)', () => {
    expect(ROLE_STEP['ilmiy_bolim']).toBeUndefined();
    expect(ROLE_STEP['fakultet_kengash_kotibi']).toBeUndefined();
  });
});

describe('useMyApprovalStepKeys', () => {
  it('zanjir roli o`z bosqich kalitini oladi', () => {
    login(['kafedra_mudiri']);

    expect(render()).toEqual({ stepKeys: ['kafedraMudiri'], showAll: false });
  });

  it('bir nechta rol — barcha bosqichlar yig`iladi', () => {
    login(['kafedra_ilmiy_masul', 'dekan']);

    expect(render().stepKeys).toEqual(['kafedraIlmiy', 'dekan']);
  });

  it('zanjirda bosqichi YO`Q rol (`ilmiy_bolim`) — bo`sh ro`yxat ⇒ bo`sh navbat, 403 yo`q', () => {
    login(['ilmiy_bolim']);

    expect(render()).toEqual({ stepKeys: [], showAll: false });
  });

  it('`fakultet_kengash_kotibi` ham bo`sh ro`yxat oladi', () => {
    login(['fakultet_kengash_kotibi']);

    expect(render().stepKeys).toEqual([]);
  });

  it('noma`lum rol tashlab yuboriladi (undefined kalit sizib chiqmaydi)', () => {
    login(['kafedra_mudiri', 'allaqanday_yangi_rol']);

    expect(render().stepKeys).toEqual(['kafedraMudiri']);
  });

  it('sessiyasiz — bo`sh ro`yxat, showAll false', () => {
    logout();

    expect(render()).toEqual({ stepKeys: [], showAll: false });
  });

  it('`*` (super_admin / dev mock) — showAll true (aks holda dev`da ekran doim bo`sh)', () => {
    login(['Developer'], ['*']);

    expect(render().showAll).toBe(true);
  });
});
