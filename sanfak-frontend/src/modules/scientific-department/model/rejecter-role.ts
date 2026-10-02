const KEY_BY_ROLE: Readonly<Record<string, string>> = {
  ilmiy_bolim: 'scientificDepartment.dashboard.roleName.ilmiy',
  ilmiy_kengash_kotibi: 'scientificDepartment.dashboard.roleName.kotib',
  rektor: 'scientificDepartment.dashboard.roleName.rektor',
  prorektor: 'scientificDepartment.dashboard.roleName.prorektor',
  dekan: 'scientificDepartment.dashboard.roleName.dekan',
  ssv: 'scientificDepartment.rejecter.ssv',
};

export function rejecterRoleLabel(
  role: string | null | undefined,
  t: (key: string) => string,
): string | null {
  const key = role ? KEY_BY_ROLE[role] : undefined;
  return key ? t(key) : null;
}
