import { useProfile } from '../api/residency-api';

export type Surface =
  | 'xodim'
  | 'rezident'
  | 'klinik_ustoz'
  | 'kafedra_mudiri'
  | 'rahbar'
  | 'magistrant'
  | 'ilmiy_rahbar';

const ROLE_MAP: Record<string, Surface> = {
  magistratura_bolim: 'xodim',
  rezident: 'rezident',
  klinik_ustoz: 'klinik_ustoz',
  kafedra_mudiri: 'kafedra_mudiri',
  rektor: 'rahbar',
  prorektor: 'rahbar',
  magistrant: 'magistrant',
  ilmiy_rahbar: 'ilmiy_rahbar',
};
function mapRole(title: string): Surface {
  return ROLE_MAP[title] ?? 'xodim';
}

export interface ResidencyUser {
  id: string;
  role: Surface;
  name: string;
  roleTitle: string;
  position?: string;
  avatar?: string | null;
}

export function useAuth(): { user: ResidencyUser; isLoading: boolean } {
  const { data: profile, isLoading } = useProfile();
  const roleTitle = profile?.role?.title || profile?.role?.name || '';
  const role: Surface = profile ? mapRole(roleTitle) : 'xodim';
  const name = profile ? `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() : '';

  const user: ResidencyUser = {
    id: profile?._id ?? '',
    role,
    name: name || (profile?.role?.title ?? ''),
    roleTitle,
    position: profile?.position,
    avatar: profile?.photo ?? null,
  };

  return { user, isLoading };
}
