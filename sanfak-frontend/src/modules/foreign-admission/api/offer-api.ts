import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchOne, putJson } from '@/shared/api';
import type { AdmissionOffer, OfferBlock } from '../model/admission-types';

const ROOT = '/admission-offer';
const KEY = ['foreign-admission', 'offer'];

interface BackendBlock {
  _id?: string;
  order?: number;
  titleUz?: string;
  titleRu?: string;
  titleEn?: string;
  bodyUz?: string;
  bodyRu?: string;
  bodyEn?: string;
}

interface BackendOffer {
  blocks?: BackendBlock[];
  updatedBy?: { firstName?: string; lastName?: string } | null;
  updatedAt?: string;
}

const mapBlock = (b: BackendBlock, index: number): OfferBlock => ({
  key: b._id ?? `srv-${index}`,
  titleUz: b.titleUz ?? '',
  titleRu: b.titleRu ?? '',
  titleEn: b.titleEn ?? '',
  bodyUz: b.bodyUz ?? '',
  bodyRu: b.bodyRu ?? '',
  bodyEn: b.bodyEn ?? '',
});

function mapOffer(b: BackendOffer | null): AdmissionOffer {
  const person = b?.updatedBy;
  return {
    blocks: (b?.blocks ?? []).map(mapBlock),
    updatedByName: person
      ? [person.lastName, person.firstName].filter(Boolean).join(' ') || undefined
      : undefined,
    updatedAt: b?.updatedAt,
  };
}

export function useAdmissionOffer() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => mapOffer(await fetchOne<BackendOffer>(ROOT)),
  });
}

export function useSaveAdmissionOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blocks: OfferBlock[]) =>
      putJson<{ message: string }>(ROOT, {
        blocks: blocks.map(({ key: _key, ...rest }) => rest),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
