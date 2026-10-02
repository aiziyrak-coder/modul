import type { ExpulsionOrderOrigin, ExpulsionOrderStatus } from '../api/expulsion-order-types';

export type ListTab = ExpulsionOrderStatus | 'all';

export interface ListView {
  tab: ListTab;
  origin: ExpulsionOrderOrigin | '';
  page: number;
}

export const DEFAULT_LIST_VIEW: Readonly<ListView> = { tab: 'loyiha', origin: '', page: 1 };

const TABS: ReadonlySet<string> = new Set(['loyiha', 'imzolangan', 'rad_etilgan', 'bekor_qilingan', 'all']);

const isTab = (v: string | null): v is ListTab => v !== null && TABS.has(v);

export const toOrigin = (v: string | null): ExpulsionOrderOrigin | '' =>
  v === 'tizim' || v === 'meros' ? v : '';

function toPage(v: string | null): number {
  return v !== null && /^[1-9]\d{0,4}$/.test(v) ? Number(v) : 1;
}

export function parseListView(search: URLSearchParams): ListView {
  const status = search.get('status');
  return {
    tab: isTab(status) ? status : DEFAULT_LIST_VIEW.tab,
    origin: toOrigin(search.get('origin')),
    page: toPage(search.get('page')),
  };
}

export function toListSearch(view: ListView): URLSearchParams {
  const search = new URLSearchParams();
  if (view.tab !== DEFAULT_LIST_VIEW.tab) search.set('status', view.tab);
  if (view.origin) search.set('origin', view.origin);
  if (view.page > 1) search.set('page', String(view.page));
  return search;
}

export interface ListReturnState {
  listSearch: string;
}

export function listReturnPath(listPath: string, state: unknown): string {
  const raw =
    typeof state === 'object' && state !== null && typeof (state as Partial<ListReturnState>).listSearch === 'string'
      ? (state as ListReturnState).listSearch
      : '';
  const search = toListSearch(parseListView(new URLSearchParams(raw))).toString();
  return search ? `${listPath}?${search}` : listPath;
}
