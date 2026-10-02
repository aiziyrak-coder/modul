export interface CoordPair {
  lat: number;
  lng: number;
}

export type CoordParse =
  | { kind: 'empty' }
  | { kind: 'ok'; value: CoordPair }
  | { kind: 'error'; message: string };

export const LAT_RANGE = [-90, 90] as const;
export const LNG_RANGE = [-180, 180] as const;

export function parseCoordPair(text: string): CoordParse {
  const raw = text.trim();
  if (!raw) return { kind: 'empty' };

  const parts = raw.split(/[;,\s]+/).filter(Boolean);

  if (parts.length === 4) {
    return {
      kind: 'error',
      message:
        "O'nlik ajratgich sifatida VERGUL ishlatilgan — nuqta qo'ying: 41.311081, 69.240562",
    };
  }
  if (parts.length !== 2) {
    return {
      kind: 'error',
      message: "Kutilgan shakl: 41.311081, 69.240562",
    };
  }

  const [lat, lng] = parts.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { kind: 'error', message: 'Koordinata son bo‘lishi kerak' };
  }
  if (
    (lat as number) < LAT_RANGE[0] ||
    (lat as number) > LAT_RANGE[1] ||
    (lng as number) < LNG_RANGE[0] ||
    (lng as number) > LNG_RANGE[1]
  ) {
    return {
      kind: 'error',
      message: 'Kenglik −90…90, uzunlik −180…180 orasida bo‘lishi kerak',
    };
  }

  return { kind: 'ok', value: { lat: lat as number, lng: lng as number } };
}

export function formatCoordPair(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return '';
  return `${lat}, ${lng}`;
}
