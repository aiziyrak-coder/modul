export interface DistributionStatusLike {
  status?: string | null;
  active?: boolean | null;
}

export function isSelectableDistribution(d: DistributionStatusLike): boolean {
  if (d.active === false) return false;
  return d.status !== 'superseded';
}
